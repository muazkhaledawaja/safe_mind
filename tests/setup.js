// Runs before each test file. Truncates every app table so tests start
// from a clean slate without re-running migrations each time.
process.env.NODE_ENV = 'test';
const { pool } = require('../src/config/db');

const TABLES = [
  'messages',
  'conversations',
  'appointments',
  'mood_logs',
  'articles',
  'categories',
  'emergency_alerts',
  'emergency_contacts',
  'specialists',
  'audit_logs',
  'users',
];

beforeEach(async () => {
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of TABLES) {
    await pool.query(`TRUNCATE TABLE ${table}`);
  }
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
});

afterAll(async () => {
  await pool.end();
});
