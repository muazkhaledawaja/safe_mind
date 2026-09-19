const { query, pool } = require('../../config/db');
const { sendMail } = require('../../config/mailer');
const { writeAudit } = require('../../utils/audit');
const logger = require('../../utils/logger');
const { NotFoundError, ConflictError, AppError } = require('../../utils/errors');
const { findById: findUserById } = require('../users/users.service');

const MAX_CONTACTS = 3;
const ALERTS_PER_HOUR = 3;

// The only shape ever returned for a contact. Never joined with or exposed
// through any other user's endpoint (CLAUDE.md rule 2).
function toView(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    relationship: row.relationship,
    isPrimary: !!row.is_primary,
    createdAt: row.created_at,
  };
}

async function listContacts(userId) {
  const rows = await query(
    'SELECT * FROM emergency_contacts WHERE user_id = ? ORDER BY is_primary DESC, created_at ASC',
    [userId]
  );
  return rows.map(toView);
}

async function findOwnContact(userId, contactId) {
  const rows = await query('SELECT * FROM emergency_contacts WHERE id = ? AND user_id = ?', [
    contactId,
    userId,
  ]);
  if (!rows[0]) throw new NotFoundError('Emergency contact not found');
  return rows[0];
}

async function createContact(userId, data) {
  const insertId = await insertContact(userId, data);
  return toView(await findOwnContact(userId, insertId));
}

async function insertContact(userId, data) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existingRows] = await conn.query(
      'SELECT COUNT(*) AS count FROM emergency_contacts WHERE user_id = ? FOR UPDATE',
      [userId]
    );
    if (existingRows[0].count >= MAX_CONTACTS) {
      throw new ConflictError('CONTACT_LIMIT_REACHED', `You can have at most ${MAX_CONTACTS} emergency contacts`);
    }

    // First contact is always primary; otherwise honor the request and
    // demote any previous primary so exactly one stays true.
    const isPrimary = existingRows[0].count === 0 ? true : !!data.isPrimary;
    if (isPrimary) {
      await conn.query('UPDATE emergency_contacts SET is_primary = 0 WHERE user_id = ?', [userId]);
    }

    const [result] = await conn.query(
      'INSERT INTO emergency_contacts (user_id, name, phone, email, relationship, is_primary) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, data.name, data.phone || null, data.email, data.relationship || null, isPrimary]
    );

    await conn.commit();
    return result.insertId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function updateContact(userId, contactId, updates) {
  await findOwnContact(userId, contactId);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (updates.isPrimary === true) {
      await conn.query('UPDATE emergency_contacts SET is_primary = 0 WHERE user_id = ?', [userId]);
    }

    const fields = [];
    const params = [];
    if (updates.name !== undefined) { fields.push('name = ?'); params.push(updates.name); }
    if (updates.email !== undefined) { fields.push('email = ?'); params.push(updates.email); }
    if (updates.phone !== undefined) { fields.push('phone = ?'); params.push(updates.phone); }
    if (updates.relationship !== undefined) { fields.push('relationship = ?'); params.push(updates.relationship); }
    if (updates.isPrimary !== undefined) { fields.push('is_primary = ?'); params.push(updates.isPrimary); }

    if (fields.length > 0) {
      params.push(contactId, userId);
      await conn.query(`UPDATE emergency_contacts SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, params);
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return toView(await findOwnContact(userId, contactId));
}

async function deleteContact(userId, contactId) {
  const contact = await findOwnContact(userId, contactId);
  await query('DELETE FROM emergency_contacts WHERE id = ? AND user_id = ?', [contactId, userId]);

  // If we just deleted the primary and other contacts remain, promote the
  // oldest one so the "exactly one primary" invariant holds whenever a
  // contact exists at all.
  if (contact.is_primary) {
    const remaining = await query(
      'SELECT id FROM emergency_contacts WHERE user_id = ? ORDER BY created_at ASC LIMIT 1',
      [userId]
    );
    if (remaining[0]) {
      await query('UPDATE emergency_contacts SET is_primary = 1 WHERE id = ?', [remaining[0].id]);
    }
  }
}

// Explicit-action only: this function is reachable from exactly one route,
// POST /emergency/alert, itself reachable only by an authenticated user
// pressing the button. Nothing else in the codebase may call this.
async function sendAlert(userId, ip) {
  const [{ count: recentCount }] = await query(
    'SELECT COUNT(*) AS count FROM emergency_alerts WHERE user_id = ? AND sent_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)',
    [userId]
  );

  if (recentCount >= ALERTS_PER_HOUR) {
    await query(
      'INSERT INTO emergency_alerts (user_id, contact_id, status, ip_address) VALUES (?, NULL, ?, ?)',
      [userId, 'rate_limited', ip || null]
    );
    throw new AppError(429, 'RATE_LIMITED', 'Too many emergency alerts sent recently. Try again later.');
  }

  const contactRows = await query(
    'SELECT id, name, email FROM emergency_contacts WHERE user_id = ? AND is_primary = 1',
    [userId]
  );
  const contact = contactRows[0];
  if (!contact) {
    throw new AppError(409, 'NO_PRIMARY_CONTACT', 'Add a primary emergency contact before sending an alert');
  }

  const user = await findUserById(userId);
  let status = 'sent';
  let errorMessage = null;

  try {
    await sendMail({
      to: contact.email,
      subject: 'Emergency alert from Safe Mind',
      // Nickname only — never mood logs, messages, or anything else about the user.
      text: `${user.nickname} has used Safe Mind to reach out to you as their emergency contact. Please check on them.`,
    });
  } catch (err) {
    status = 'failed';
    errorMessage = err.message;
    logger.error('emergency_alert_mail_failed', { userId, contactId: contact.id });
  }

  const result = await query(
    'INSERT INTO emergency_alerts (user_id, contact_id, status, error_message, ip_address) VALUES (?, ?, ?, ?, ?)',
    [userId, contact.id, status, errorMessage, ip || null]
  );

  await writeAudit({
    actorId: userId,
    action: 'emergency_alert_dispatch',
    entityType: 'emergency_alert',
    entityId: result.insertId,
    metadata: { status },
    ip,
  });

  return { status, sentAt: new Date() };
}

module.exports = { listContacts, createContact, updateContact, deleteContact, sendAlert };
