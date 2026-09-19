const { query, pool } = require('../../config/db');
const { sendMail } = require('../../config/mailer');
const logger = require('../../utils/logger');
const { NotFoundError, ForbiddenError, ConflictError } = require('../../utils/errors');
const { findRawById: findSpecialistRaw } = require('../specialists/specialists.service');
const { findById: findUserById } = require('../users/users.service');

function toView(row) {
  return {
    id: row.id,
    userId: row.user_id,
    specialistId: row.specialist_id,
    scheduledAt: row.scheduled_at,
    durationMin: row.duration_min,
    status: row.status,
    userNote: row.user_note,
    responseNote: row.response_note,
    respondedAt: row.responded_at,
    cancelledBy: row.cancelled_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findById(id) {
  const rows = await query('SELECT * FROM appointments WHERE id = ?', [id]);
  if (!rows[0]) throw new NotFoundError('Appointment not found');
  return rows[0];
}

// Ownership: a request is either "the user who booked it" or "the
// specialist it was booked with" — every mutation checks this before
// touching the row.
function assertParticipant(appointment, userId, specialistUserId) {
  const isOwner = appointment.user_id === userId;
  const isSpecialist = specialistUserId === userId;
  if (!isOwner && !isSpecialist) {
    throw new ForbiddenError('You are not part of this appointment');
  }
  return { isOwner, isSpecialist };
}

async function notifyStatusChange(appointment, subject, text) {
  try {
    const user = await findUserById(appointment.user_id);
    const specialistRow = await findSpecialistRaw(appointment.specialist_id);
    const specialistUser = await findUserById(specialistRow.user_id);
    await sendMail({ to: user.email, subject, text });
    await sendMail({ to: specialistUser.email, subject, text });
  } catch (err) {
    logger.error('appointment_status_mail_failed', { appointmentId: appointment.id });
  }
}

async function create(userId, data) {
  // Confirms the specialist exists and is approved — booking an unverified
  // specialist is refused at this layer (CLAUDE.md rule 3).
  const specialist = await findSpecialistRaw(data.specialistId);
  if (specialist.verification_status !== 'approved') {
    throw new ForbiddenError('This specialist is not yet approved for bookings');
  }

  const result = await query(
    `INSERT INTO appointments (user_id, specialist_id, scheduled_at, duration_min, user_note)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, data.specialistId, data.scheduledAt, data.durationMin, data.userNote || null]
  );

  const appointment = await findById(result.insertId);
  await notifyStatusChange(
    appointment,
    'New appointment request — Safe Mind',
    'A new appointment request has been submitted and is awaiting a response.'
  );
  return toView(appointment);
}

// Accept/reject, with the overlap check applied only on accept — a pending
// request never blocks another pending request for the same slot.
async function respond(specialistUserId, appointmentId, { decision, responseNote }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT * FROM appointments WHERE id = ? FOR UPDATE', [appointmentId]);
    const appointment = rows[0];
    if (!appointment) throw new NotFoundError('Appointment not found');

    const specialist = await findSpecialistRaw(appointment.specialist_id);
    if (specialist.user_id !== specialistUserId) {
      throw new ForbiddenError('You are not part of this appointment');
    }
    if (appointment.status !== 'pending') {
      throw new ConflictError('APPOINTMENT_NOT_PENDING', 'This appointment has already been responded to');
    }

    if (decision === 'accepted') {
      const [overlaps] = await conn.query(
        `SELECT id FROM appointments
         WHERE specialist_id = ? AND status = 'accepted' AND id != ?
           AND scheduled_at < DATE_ADD(?, INTERVAL ? MINUTE)
           AND DATE_ADD(scheduled_at, INTERVAL duration_min MINUTE) > ?`,
        [
          appointment.specialist_id,
          appointmentId,
          appointment.scheduled_at,
          appointment.duration_min,
          appointment.scheduled_at,
        ]
      );
      if (overlaps.length > 0) {
        throw new ConflictError('APPOINTMENT_CONFLICT', 'You already have an accepted appointment in this time slot');
      }
    }

    await conn.query(
      'UPDATE appointments SET status = ?, response_note = ?, responded_at = NOW() WHERE id = ?',
      [decision, responseNote || null, appointmentId]
    );

    if (decision === 'accepted') {
      await conn.query(
        `INSERT INTO conversations (user_id, specialist_id, appointment_id)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE appointment_id = VALUES(appointment_id)`,
        [appointment.user_id, appointment.specialist_id, appointmentId]
      );
    }

    await conn.commit();

    const updated = await findById(appointmentId);
    await notifyStatusChange(
      updated,
      `Appointment ${decision} — Safe Mind`,
      `Your appointment has been ${decision}.`
    );
    return toView(updated);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Either party can cancel, only before the appointment's scheduled time.
async function cancel(userId, appointmentId) {
  const appointment = await findById(appointmentId);
  const specialist = await findSpecialistRaw(appointment.specialist_id);
  assertParticipant(appointment, userId, specialist.user_id);

  if (['cancelled', 'rejected', 'completed'].includes(appointment.status)) {
    throw new ConflictError('APPOINTMENT_NOT_CANCELLABLE', 'This appointment cannot be cancelled');
  }
  if (new Date(appointment.scheduled_at) <= new Date()) {
    throw new ForbiddenError('This appointment has already started or passed');
  }

  await query('UPDATE appointments SET status = ?, cancelled_by = ? WHERE id = ?', [
    'cancelled',
    userId,
    appointmentId,
  ]);

  const updated = await findById(appointmentId);
  await notifyStatusChange(updated, 'Appointment cancelled — Safe Mind', 'An appointment has been cancelled.');
  return toView(updated);
}

// A user's own bookings, or a specialist's own incoming bookings — never
// both, and never another party's.
async function listForUser(userId, { page, limit, status }) {
  return listByFilter('user_id = ?', userId, { page, limit, status });
}

async function listForSpecialist(specialistUserId, { page, limit, status }) {
  const specialistRows = await query('SELECT id FROM specialists WHERE user_id = ?', [specialistUserId]);
  if (specialistRows.length === 0) return { items: [], meta: { page, limit, total: 0 } };
  return listByFilter('specialist_id = ?', specialistRows[0].id, { page, limit, status });
}

async function listByFilter(column, value, { page, limit, status }) {
  const where = [column];
  const params = [value];
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  const whereSql = ` WHERE ${where.join(' AND ')}`;

  const [{ count: total }] = await query(`SELECT COUNT(*) AS count FROM appointments${whereSql}`, params);
  const rows = await query(
    `SELECT * FROM appointments${whereSql} ORDER BY scheduled_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  );

  return { items: rows.map(toView), meta: { page, limit, total } };
}

module.exports = { create, respond, cancel, listForUser, listForSpecialist, findById, toView };
