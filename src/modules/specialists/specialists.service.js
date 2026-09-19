const { query } = require('../../config/db');
const { NotFoundError, ConflictError } = require('../../utils/errors');
const { toMeta } = require('../../utils/pagination');

// Public view — never leaks license_number/license_document/rejection_reason
// or the linked user's email/full_name.
function toView(row) {
  return {
    id: row.id,
    userId: row.user_id,
    nickname: row.nickname,
    specialization: row.specialization,
    bio: row.bio,
    yearsExperience: row.years_experience,
    verificationStatus: row.verification_status,
  };
}

// CLAUDE.md §6: registration always creates role='user'; applying as a
// specialist creates this row pending, and only an admin approval flips the
// user's role to 'specialist' (Phase 6). A user can only ever have one
// specialists row (uq_specialists_user).
async function apply(userId, data) {
  const existing = await query('SELECT id FROM specialists WHERE user_id = ?', [userId]);
  if (existing.length > 0) {
    throw new ConflictError('ALREADY_APPLIED', 'You have already submitted a specialist application');
  }

  const result = await query(
    `INSERT INTO specialists (user_id, specialization, bio, license_number, years_experience)
     VALUES (?, ?, ?, ?, ?) RETURNING id`,
    [userId, data.specialization, data.bio || null, data.licenseNumber || null, data.yearsExperience ?? null]
  );

  return findByIdForAdmin(result[0].id);
}

// Public listing: approved specialists only, optional specialization filter.
async function listApproved({ page, limit, specialization }) {
  const where = ['s.verification_status = ?'];
  const params = ['approved'];
  if (specialization) {
    where.push('s.specialization = ?');
    params.push(specialization);
  }
  const whereSql = ` WHERE ${where.join(' AND ')}`;

  const [{ count: total }] = await query(
    `SELECT COUNT(*) AS count FROM specialists s${whereSql}`,
    params
  );
  const rows = await query(
    `SELECT s.*, u.nickname FROM specialists s JOIN users u ON u.id = s.user_id${whereSql}
     ORDER BY s.id ASC LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );

  return { items: rows.map(toView), meta: toMeta(page, limit, total) };
}

async function findApprovedById(id) {
  const rows = await query(
    `SELECT s.*, u.nickname FROM specialists s JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.verification_status = ?`,
    [id, 'approved']
  );
  if (!rows[0]) throw new NotFoundError('Specialist not found');
  return rows[0];
}

// Internal use only (booking flow, messaging gate) — bypasses the approved
// filter so we can give a clear error rather than a bare 404 when a
// specialist exists but isn't approved yet.
async function findRawById(id) {
  const rows = await query('SELECT * FROM specialists WHERE id = ?', [id]);
  if (!rows[0]) throw new NotFoundError('Specialist not found');
  return rows[0];
}

async function findByIdForAdmin(id) {
  const rows = await query(
    `SELECT s.*, u.nickname FROM specialists s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    [id]
  );
  if (!rows[0]) throw new NotFoundError('Specialist not found');
  return toView(rows[0]);
}

module.exports = { apply, listApproved, findApprovedById, findRawById, toView };
