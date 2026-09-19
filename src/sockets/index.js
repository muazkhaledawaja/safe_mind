const { Server } = require('socket.io');
const { setIo } = require('./io');
const authenticateSocket = require('./auth');
const registerConnection = require('./connection');

// Attach socket.io to the same HTTP server as Express so both share port 4000.
// Deployment is a single PM2 fork, so no Redis adapter is needed. Tests call
// initSockets(server) exactly the way server.js does.
function initSockets(server) {
  const io = new Server(server, {
    // Same open policy as Express `cors()`. Auth is the handshake token, not a
    // cookie, so credentials are not needed.
    cors: { origin: true },
  });

  setIo(io);
  io.use(authenticateSocket);
  registerConnection(io);

  return io;
}

module.exports = initSockets;