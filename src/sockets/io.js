// Singleton holder for the socket.io instance. Messages services emit through
// this so the emitter can no-op when no socket.io server is attached.
let io = null;

function setIo(instance) {
  io = instance;
}

function getIo() {
  return io;
}

module.exports = { setIo, getIo };