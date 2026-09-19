jest.mock('../src/config/mailer', () => require('./__mocks__/mailer'));

const request = require('supertest');
const app = require('../src/app');
const { query } = require('../src/config/db');

describe('auth', () => {
  const credentials = { nickname: 'Sara', email: 'sara@example.com', password: 'password1' };

  test('register creates a user and returns a token', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(credentials);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user.role).toBe('user');
    expect(res.body.data.user.email).toBe(credentials.email);
    expect(res.body.data.user.password_hash).toBeUndefined();
  });

  test('duplicate email is rejected with 409', async () => {
    await request(app).post('/api/v1/auth/register').send(credentials);
    const res = await request(app).post('/api/v1/auth/register').send(credentials);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  test('invalid body is rejected with 400', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ nickname: 'a', email: 'not-an-email', password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('login with correct credentials succeeds', async () => {
    await request(app).post('/api/v1/auth/register').send(credentials);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: credentials.email, password: credentials.password });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
  });

  test('login with wrong password fails with 401', async () => {
    await request(app).post('/api/v1/auth/register').send(credentials);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: credentials.email, password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  test('GET /auth/me requires a valid token', async () => {
    const registerRes = await request(app).post('/api/v1/auth/register').send(credentials);
    const token = registerRes.body.data.token;

    const noToken = await request(app).get('/api/v1/auth/me');
    expect(noToken.status).toBe(401);

    const badToken = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer garbage');
    expect(badToken.status).toBe(401);

    const ok = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.email).toBe(credentials.email);
  });

  test('forgot-password then reset-password lets the user log in with the new password', async () => {
    await request(app).post('/api/v1/auth/register').send(credentials);

    const forgotRes = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: credentials.email });
    expect(forgotRes.status).toBe(200);

    const rows = await query('SELECT reset_token FROM users WHERE email = ?', [credentials.email]);
    const token = rows[0].reset_token;
    expect(token).toBeTruthy();

    const resetRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'new-password1' });
    expect(resetRes.status).toBe(200);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: credentials.email, password: 'new-password1' });
    expect(loginRes.status).toBe(200);

    // The same token cannot be reused.
    const reuseRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'another-password1' });
    expect(reuseRes.status).toBe(400);
    expect(reuseRes.body.error.code).toBe('INVALID_TOKEN');
  });

  test('forgot-password returns 200 even for an unknown email', async () => {
    const res = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'nobody@example.com' });
    expect(res.status).toBe(200);
  });
});
