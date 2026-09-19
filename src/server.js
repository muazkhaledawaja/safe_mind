const env = require('./config/env');
const app = require('./app');

// Local development entry point only. Vercel mounts the Express app via
// api/index.js; for long-running use, prefer `npm run start` under a process
// manager in front of whatever scales horizontally.
app.listen(env.PORT, () => {
  console.log(`Safe Mind API listening on port ${env.PORT}`);
  console.log(`API docs:            http://localhost:${env.PORT}/api/docs`);
});