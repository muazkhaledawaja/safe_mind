const { query } = require('../../config/db');
const { NotFoundError, ForbiddenError } = require('../../utils/errors');
const { toMeta } = require('../../utils/pagination');

function conversationView(row) {
  return {
    id: row.id,
    userId: row.user_id,
    specialistId: row.specialist_id,
    appointmentId: row.appointment_id,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
  };
}

function messageView(row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    isRead: !!row.is_read,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

// A conversation only exists if an appointment was accepted for that
// user-specialist pair (created in appointments.service on accept). This
// function is the single ownership gate every route in this module goes
// through — a third party gets 403, not a leak of whether the id exists.
async function findOwnConversation(userId, userRole, conversationId) {
  const rows = await query('SELECT * FROM conversations WHERE id = ?', [conversationId]);
  const conversation = rows[0];
  if (!conversation) throw new NotFoundError('Conversation not found');

  const isUser = conversation.user_id === userId;
  let isSpecialist = false;
  if (userRole === 'specialist') {
    const specialistRows = await query('SELECT id FROM specialists WHERE user_id = ?', [userId]);
    isSpecialist = specialistRows[0] && specialistRows[0].id === conversation.specialist_id;
  }

  if (!isUser && !isSpecialist) {
    throw new ForbiddenError('You are not part of this conversation');
  }

  return conversation;
}

async function listForCaller(userId, userRole) {
  let rows;
  if (userRole === 'specialist') {
    const specialistRows = await query('SELECT id FROM specialists WHERE user_id = ?', [userId]);
    if (specialistRows.length === 0) return [];
    rows = await query(
      'SELECT * FROM conversations WHERE specialist_id = ? ORDER BY last_message_at DESC',
      [specialistRows[0].id]
    );
  } else {
    rows = await query('SELECT * FROM conversations WHERE user_id = ? ORDER BY last_message_at DESC', [userId]);
  }
  return rows.map(conversationView);
}

async function listMessages(userId, userRole, conversationId, { page, limit }) {
  await findOwnConversation(userId, userRole, conversationId);

  const [{ count: total }] = await query(
    'SELECT COUNT(*) AS count FROM messages WHERE conversation_id = ?',
    [conversationId]
  );
  const rows = await query(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?',
    [conversationId, limit, (page - 1) * limit]
  );

  return { items: rows.map(messageView), meta: toMeta(page, limit, total) };
}

async function sendMessage(userId, userRole, conversationId, body) {
  await findOwnConversation(userId, userRole, conversationId);

  const result = await query(
    'INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?) RETURNING id',
    [conversationId, userId, body]
  );
  await query('UPDATE conversations SET last_message_at = NOW() WHERE id = ?', [conversationId]);

  const rows = await query('SELECT * FROM messages WHERE id = ?', [result[0].id]);
  return messageView(rows[0]);
}

// Marking read only requires being a participant of the message's
// conversation — not necessarily the recipient, matching the simple
// "either side can mark read" behavior REST polling needs here.
async function markRead(userId, userRole, messageId) {
  const rows = await query('SELECT * FROM messages WHERE id = ?', [messageId]);
  const message = rows[0];
  if (!message) throw new NotFoundError('Message not found');

  await findOwnConversation(userId, userRole, message.conversation_id);

  // Only announce a real transition: RETURNING gives us rows only when the
  // row actually flipped, so an already-read message reports no change.
  const updated = await query(
    'UPDATE messages SET is_read = TRUE, read_at = NOW() WHERE id = ? AND is_read = FALSE RETURNING id',
    [messageId]
  );

  const refreshed = await query('SELECT * FROM messages WHERE id = ?', [messageId]);
  return messageView(refreshed[0]);
}

async function unreadCount(userId, userRole) {
  let rows;
  if (userRole === 'specialist') {
    const specialistRows = await query('SELECT id FROM specialists WHERE user_id = ?', [userId]);
    if (specialistRows.length === 0) return 0;
    rows = await query(
      `SELECT COUNT(*) AS count FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE c.specialist_id = ? AND m.sender_id != ? AND m.is_read = FALSE`,
      [specialistRows[0].id, userId]
    );
  } else {
    rows = await query(
      `SELECT COUNT(*) AS count FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE c.user_id = ? AND m.sender_id != ? AND m.is_read = FALSE`,
      [userId, userId]
    );
  }
  return rows[0].count;
}

module.exports = { listForCaller, listMessages, sendMessage, markRead, unreadCount, findOwnConversation };
