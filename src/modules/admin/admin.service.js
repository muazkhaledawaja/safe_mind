const { query } = require('../../config/db');
const { writeAudit } = require('../../utils/audit');
const { toMeta } = require('../../utils/pagination');
const { NotFoundError, ConflictError } = require('../../utils/errors');
const { sendMail } = require('../../config/mailer');
const logger = require('../../utils/logger');

// Admin-facing user view — still never includes password_hash or reset_*,
// but full_name is visible here since an admin managing accounts needs it,
// unlike the public-facing views elsewhere (CLAUDE.md rule 7 only restricts
// full_name from *other users*, not from admin tooling).
function userView(row) {
  return {
    id: row.id,
    nickname: row.nickname,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    isActive: !!row.is_active,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  };
}

async function listUsers({ page, limit, role }) {
  const where = [];
  const params = [];
  if (role) {
    where.push('role = ?');
    params.push(role);
  }
  const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

  const [{ count: total }] = await query(`SELECT COUNT(*) AS count FROM users${whereSql}`, params);
  const rows = await query(
    `SELECT * FROM users${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );

  return { items: rows.map(userView), meta: toMeta(page, limit, total) };
}

async function findUserById(id) {
  const rows = await query('SELECT * FROM users WHERE id = ?', [id]);
  if (!rows[0]) throw new NotFoundError('User not found');
  return rows[0];
}

// Deactivation only ever flips is_active — it never deletes data, and the
// change is always audited (CLAUDE.md rule 4).
async function setUserStatus(actorId, targetUserId, isActive, ip) {
  const target = await findUserById(targetUserId);
  await query('UPDATE users SET is_active = ? WHERE id = ?', [isActive, targetUserId]);

  await writeAudit({
    actorId,
    action: isActive ? 'user_activate' : 'user_deactivate',
    entityType: 'user',
    entityId: targetUserId,
    ip,
  });

  return userView(await findUserById(targetUserId));
}

async function listSpecialists({ page, limit, status }) {
  const where = [];
  const params = [];
  if (status) {
    where.push('s.verification_status = ?');
    params.push(status);
  }
  const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

  const [{ count: total }] = await query(`SELECT COUNT(*) AS count FROM specialists s${whereSql}`, params);
  const rows = await query(
    `SELECT s.*, u.nickname, u.email FROM specialists s JOIN users u ON u.id = s.user_id${whereSql}
     ORDER BY s.created_at ASC LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );

  return { items: rows.map(specialistView), meta: toMeta(page, limit, total) };
}

function specialistView(row) {
  return {
    id: row.id,
    userId: row.user_id,
    nickname: row.nickname,
    email: row.email,
    specialization: row.specialization,
    bio: row.bio,
    licenseNumber: row.license_number,
    yearsExperience: row.years_experience,
    verificationStatus: row.verification_status,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
  };
}

async function findSpecialistById(id) {
  const rows = await query('SELECT * FROM specialists WHERE id = ?', [id]);
  if (!rows[0]) throw new NotFoundError('Specialist not found');
  return rows[0];
}

async function findSpecialistWithUserById(id) {
  const rows = await query(
    'SELECT s.*, u.nickname, u.email FROM specialists s JOIN users u ON u.id = s.user_id WHERE s.id = ?',
    [id]
  );
  if (!rows[0]) throw new NotFoundError('Specialist not found');
  return specialistView(rows[0]);
}

// Approving flips the linked user's role from 'user' to 'specialist' — the
// only place that ever happens (CLAUDE.md §6). Rejecting leaves the role
// untouched. Always audited, and the applicant is emailed either way.
async function verifySpecialist(actorId, specialistId, { decision, rejectionReason }, ip) {
  const specialist = await findSpecialistById(specialistId);
  if (specialist.verification_status !== 'pending') {
    throw new ConflictError('ALREADY_REVIEWED', 'This application has already been reviewed');
  }

  await query(
    `UPDATE specialists
     SET verification_status = ?, rejection_reason = ?, verified_by = ?, verified_at = NOW()
     WHERE id = ?`,
    [decision, decision === 'rejected' ? rejectionReason : null, actorId, specialistId]
  );

  if (decision === 'approved') {
    await query('UPDATE users SET role = ? WHERE id = ?', ['specialist', specialist.user_id]);
  }

  await writeAudit({
    actorId,
    action: `specialist_${decision}`,
    entityType: 'specialist',
    entityId: specialistId,
    ip,
  });

  const applicant = await findUserById(specialist.user_id);
  try {
    await sendMail({
      to: applicant.email,
      subject: `Your specialist application was ${decision} — Safe Mind`,
      text:
        decision === 'approved'
          ? 'Congratulations — your specialist application has been approved.'
          : `Your specialist application was not approved.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
    });
  } catch (err) {
    logger.error('specialist_verify_mail_failed', { specialistId });
  }

  return findSpecialistWithUserById(specialistId);
}

async function getStats() {
  const [
    [{ total_users }],
    [{ total_specialists }],
    [{ total_articles }],
    appointmentsByStatus,
    [{ alerts_last_30_days }],
  ] = await Promise.all([
    query('SELECT COUNT(*) AS total_users FROM users'),
    query("SELECT COUNT(*) AS total_specialists FROM specialists WHERE verification_status = 'approved'"),
    query("SELECT COUNT(*) AS total_articles FROM articles WHERE status = 'published'"),
    query('SELECT status, COUNT(*) AS count FROM appointments GROUP BY status'),
    query('SELECT COUNT(*) AS alerts_last_30_days FROM emergency_alerts WHERE sent_at > NOW() - interval \'30 day\''),
  ]);

  const appointmentCounts = { pending: 0, accepted: 0, rejected: 0, cancelled: 0, completed: 0 };
  for (const row of appointmentsByStatus) {
    appointmentCounts[row.status] = row.count;
  }

  return {
    totalUsers: total_users,
    totalApprovedSpecialists: total_specialists,
    totalPublishedArticles: total_articles,
    appointmentsByStatus: appointmentCounts,
    emergencyAlertsLast30Days: alerts_last_30_days,
  };
}

async function listAuditLogs({ page, limit, actorId, action }) {
  const where = [];
  const params = [];
  if (actorId) { where.push('actor_id = ?'); params.push(actorId); }
  if (action) { where.push('action = ?'); params.push(action); }
  const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

  const [{ count: total }] = await query(`SELECT COUNT(*) AS count FROM audit_logs${whereSql}`, params);
  const rows = await query(
    `SELECT * FROM audit_logs${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );

  return {
    items: rows.map((row) => ({
      id: row.id,
      actorId: row.actor_id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadata: row.metadata,
      ipAddress: row.ip_address,
      createdAt: row.created_at,
    })),
    meta: toMeta(page, limit, total),
  };
}

module.exports = {
  listUsers,
  setUserStatus,
  listSpecialists,
  verifySpecialist,
  getStats,
  listAuditLogs,
};
