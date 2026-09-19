const { getIo } = require('./io');

// Conversation-scoped rooms. A socket only lands here after the same ownership
// check REST uses — see connection.js.
function roomFor(conversationId) {
  return `conv:${conversationId}`;
}

// Safe no-op when socket.io is not attached (plain REST test runs), so existing
// service tests keep passing unchanged.
function emitToConversation(conversationId, event, payload) {
  const io = getIo();
  if (!io) return;
  io.to(roomFor(conversationId)).emit(event, payload);
}

module.exports = { roomFor, emitToConversation };