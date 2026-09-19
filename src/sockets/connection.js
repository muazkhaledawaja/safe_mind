const { roomFor, emitToConversation } = require('./emitter');
const { listForCaller, findOwnConversation } = require('../modules/messages/messages.service');
const store = require('./store');

function announcePresence(conversationId, userId, online) {
  emitToConversation(conversationId, 'presence:update', { conversationId, userId, online });
}

function registerConnection(io) {
  io.on('connection', async (socket) => {
    const { id: userId, role } = socket.user;
    store.addSocket(userId, socket.id);

    // Handlers are registered before the async room setup below so an early
    // client event is never silently dropped.

    // A conversation created after this socket connected (e.g. an appointment
    // accepted while the client is online). Same gate REST uses
    // (findOwnConversation) — a socket is never added to a room it has not earned.
    socket.on('conversation:join', async (data) => {
      const conversationId = Number(data && data.conversationId);
      if (!conversationId || socket.rooms.has(roomFor(conversationId))) return;
      try {
        await findOwnConversation(userId, role, conversationId);
      } catch (err) {
        socket.emit('conversation:error', { code: err.code || 'FORBIDDEN', message: err.message });
        return;
      }
      socket.join(roomFor(conversationId));
      store.addSocketConversation(socket.id, conversationId);
      announcePresence(conversationId, userId, true);
    });

    // No DB query per keystroke: a socket is only in a room after passing the
    // ownership gate, so room membership is the authorisation check.
    socket.on('typing:set', (data) => {
      const conversationId = Number(data && data.conversationId);
      if (!conversationId || !socket.rooms.has(roomFor(conversationId))) return;
      socket
        .to(roomFor(conversationId))
        .emit('typing:update', { conversationId, userId, isTyping: Boolean(data.isTyping) });
    });

    socket.on('disconnect', () => {
      for (const conversationId of store.removeSocket(userId, socket.id)) {
        if (!store.isOnlineIn(userId, conversationId)) announcePresence(conversationId, userId, false);
      }
    });

    // Auto-join every conversation the user is a participant of, using the same
    // ownership rules as GET /conversations. `ready` tells the client the rooms
    // are joined — the socket.io `connect` event fires before this completes.
    try {
      const conversationIds = (await listForCaller(userId, role)).map((c) => c.id);
      for (const conversationId of conversationIds) {
        socket.join(roomFor(conversationId));
        store.addSocketConversation(socket.id, conversationId);
      }
      for (const conversationId of conversationIds) announcePresence(conversationId, userId, true);
      socket.emit('ready', { conversationIds });
    } catch {
      // An unhandled rejection here would crash the process. Drop the socket
      // and let the client reconnect once the database is reachable again.
      socket.disconnect(true);
    }
  });
}

module.exports = registerConnection;
