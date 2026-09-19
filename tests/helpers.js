// Shared fixtures for integration tests. Every test file truncates the DB
// before each test (see setup.js), so these always start from empty tables.
const request = require('supertest');
const app = require('../src/app');
const { query } = require('../src/config/db');

async function registerAndLogin(email, password = 'password1') {
  await request(app).post('/api/v1/auth/register').send({ nickname: 'Test', email, password });
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  return res.body.data.token;
}

// Registers a user, applies as a specialist, and directly approves them
// (bypassing the admin verify endpoint), returning both the specialist's own
// token and their specialist id.
async function createApprovedSpecialist(email = 'specialist@example.com') {
  const token = await registerAndLogin(email);
  const applyRes = await request(app)
    .post('/api/v1/specialists/apply')
    .set('Authorization', `Bearer ${token}`)
    .send({ specialization: 'anxiety' });

  await query('UPDATE specialists SET verification_status = ? WHERE id = ?', [
    'approved',
    applyRes.body.data.id,
  ]);
  await query('UPDATE users SET role = ? WHERE email = ?', ['specialist', email]);

  // Re-login so the token carries the updated role.
  const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password: 'password1' });
  return { token: loginRes.body.data.token, specialistId: applyRes.body.data.id };
}

module.exports = { registerAndLogin, createApprovedSpecialist };
