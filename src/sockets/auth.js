const { verifyUser } = require('../middleware/auth');

// Socket equivalent of middleware/requireAuth. The token travels in the
// handshake `auth` object (not the query string, which lands in access logs).
// The connection is rejected before it can join any room; the client sees a
// `connect_error` whose `data.code` matches the REST envelope.
async function authenticateSocket(socket, next) {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) throw new Error('Missing token');

    socket.user = await verifyUser(token);
    next();
  } catch (err) {
    const error = new Error(err.message);
    error.data = { code: 'UNAUTHORIZED' };
    next(error);
  }
}

module.exports = authenticateSocket;
