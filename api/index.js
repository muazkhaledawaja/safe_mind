const app = require('../src/app');

// Vercel serverless entry point. The Express app is mounted directly — there
// is no long-lived HTTP server (Vercel manages listeners), so socket.io-style
// upgrades are intentionally absent. Realtime happens over Supabase, and REST
// stays the single write path.
module.exports = app;