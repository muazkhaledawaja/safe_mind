jest.mock('../src/config/mailer', () => require('./__mocks__/mailer'));

const request = require('supertest');
const express = require('express');
const authApp = require('../src/app');
const { query } = require('../src/config/db');
const requireAuth = require('../src/middleware/auth');
const requireRole = require('../src/middleware/requireRole');
const errorHandler = require('../src/middleware/errorHandler');

// Registration/login go through the real app; the admin-only probe route is
// a minimal standalone app so requireAuth/requireRole can be exercised
// end-to-end without editing src/app.js just for a test.
const probeApp = express();
probeApp.get('/api/v1/_admin-probe', requireAuth, requireRole('admin'), (req, res) => {
  res.status(200).json({ success: true, data: { ok: true } });
});
probeApp.use(errorHandler);

async function registerAndLogin(email, role = 'user') {
  await request(authApp)
    .post('/api/v1/auth/register')
    .send({ nickname: 'Test', email, password: 'password1' });

  if (role !== 'user') {
    await query('UPDATE users SET role = ? WHERE email = ?', [role, email]);
  }

  const loginRes = await request(authApp).post('/api/v1/auth/login').send({ email, password: 'password1' });
  return loginRes.body.data.token;
}

describe('role enforcement', () => {
  test('unauthenticated request to a protected route is rejected with 401', async () => {
    const res = await request(probeApp).get('/api/v1/_admin-probe');
    expect(res.status).toBe(401);
  });

  test('a user hitting an admin-only route is rejected with 403', async () => {
    const token = await registerAndLogin('user@example.com', 'user');
    const res = await request(probeApp).get('/api/v1/_admin-probe').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('an admin can reach an admin-only route', async () => {
    const token = await registerAndLogin('admin@example.com', 'admin');
    const res = await request(probeApp).get('/api/v1/_admin-probe').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
