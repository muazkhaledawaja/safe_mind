const http = require('http');
const env = require('./config/env');
const app = require('./app');
const initSockets = require('./sockets');

const server = http.createServer(app);
initSockets(server);

server.listen(env.PORT, () => {
  console.log(`Safe Mind API listening on port ${env.PORT}`);
  console.log(`API docs:            http://localhost:${env.PORT}/api/docs`);
});
