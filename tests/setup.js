// Runs before each test file. Truncates every app table and the Supabase
// Auth tables so tests start from a clean slate without re-running
// migrations each time. auth.users must also be cleared between tests:
// registration lives in Supabase Auth, and Supabase rejects a duplicate
// email even if the app-level users row was already wiped.
process.env.NODE_ENV = 'test';
const { pool } = require('../src/config/db');

beforeEach(async () => {
  await pool.query(
    'TRUNCATE TABLE messages, conversations, appointments, mood_logs, articles, ' +
      'categories, emergency_alerts, emergency_contacts, specialists, audit_logs, users CASCADE'
  );
  await pool.query('TRUNCATE TABLE auth.users CASCADE');
});

afterAll(async () => {
  await pool.end();
});