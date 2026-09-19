// In-memory ephemeral presence state. Never written to the database. A process
// restart simply means everyone is offline until their clients reconnect.

// userId -> Set of socket ids
const onlineSockets = new Map();
// socketId -> Set of conversation ids that socket has joined
const socketConversations = new Map();

function addSocket(userId, socketId) {
  if (!onlineSockets.has(userId)) onlineSockets.set(userId, new Set());
  onlineSockets.get(userId).add(socketId);
  socketConversations.set(socketId, new Set());
}

function addSocketConversation(socketId, conversationId) {
  const conversations = socketConversations.get(socketId);
  if (conversations) conversations.add(conversationId);
}

// Removes a socket and returns the conversation ids it had joined.
function removeSocket(userId, socketId) {
  const conversationIds = [...(socketConversations.get(socketId) || [])];
  socketConversations.delete(socketId);
  const sockets = onlineSockets.get(userId);
  if (sockets) {
    sockets.delete(socketId);
    if (sockets.size === 0) onlineSockets.delete(userId);
  }
  return conversationIds;
}

// True when the user still has at least one live socket in this conversation.
function isOnlineIn(userId, conversationId) {
  const sockets = onlineSockets.get(userId);
  if (!sockets) return false;
  for (const socketId of sockets) {
    const conversations = socketConversations.get(socketId);
    if (conversations && conversations.has(conversationId)) return true;
  }
  return false;
}

module.exports = { addSocket, addSocketConversation, removeSocket, isOnlineIn };
