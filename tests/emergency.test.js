jest.mock('../src/config/mailer', () => require('./__mocks__/mailer'));

const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const mailer = require('./__mocks__/mailer');

async function registerAndGetToken(email = 'user@example.com') {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ nickname: 'Test', email, password: 'password1' });
  return res.body.data.token;
}

beforeEach(() => {
  mailer.sendMail.mockClear();
  mailer.sendMail.mockResolvedValue(true);
});

describe('emergency contacts', () => {
  test('first contact created is automatically primary', async () => {
    const token = await registerAndGetToken();
    const res = await request(app)
      .post('/api/v1/emergency/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mom', email: 'mom@example.com' });

    expect(res.status).toBe(201);
    expect(res.body.data.isPrimary).toBe(true);
  });

  test('a 4th contact is rejected with 409', async () => {
    const token = await registerAndGetToken();
    for (const n of ['a', 'b', 'c']) {
      await request(app)
        .post('/api/v1/emergency/contacts')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: n, email: `${n}@example.com` });
    }

    const res = await request(app)
      .post('/api/v1/emergency/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'd', email: 'd@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONTACT_LIMIT_REACHED');
  });

  test('setting a new contact as primary demotes the previous one', async () => {
    const token = await registerAndGetToken();
    await request(app)
      .post('/api/v1/emergency/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'a', email: 'a@example.com' });

    const secondRes = await request(app)
      .post('/api/v1/emergency/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'b', email: 'b@example.com', isPrimary: true });

    const list = await request(app)
      .get('/api/v1/emergency/contacts')
      .set('Authorization', `Bearer ${token}`);

    const primaries = list.body.data.filter((c) => c.isPrimary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0].id).toBe(secondRes.body.data.id);
  });

  test('a user cannot access another user contacts', async () => {
    const tokenA = await registerAndGetToken('a@example.com');
    const tokenB = await registerAndGetToken('b@example.com');

    const created = await request(app)
      .post('/api/v1/emergency/contacts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'a-contact', email: 'ac@example.com' });

    const res = await request(app)
      .patch(`/api/v1/emergency/contacts/${created.body.data.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'hijacked' });

    expect(res.status).toBe(404);
  });

  test('GET /emergency/resources requires no auth', async () => {
    const res = await request(app).get('/api/v1/emergency/resources');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('emergency alert', () => {
  test('sending an alert emails the primary contact and writes a row', async () => {
    const token = await registerAndGetToken();
    await request(app)
      .post('/api/v1/emergency/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mom', email: 'mom@example.com' });

    const res = await request(app).post('/api/v1/emergency/alert').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('sent');
    expect(mailer.sendMail).toHaveBeenCalledTimes(1);
    expect(mailer.sendMail.mock.calls[0][0].to).toBe('mom@example.com');

    const [rows] = await pool.query('SELECT status FROM emergency_alerts');
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('sent');
  });

  test('without a primary contact the alert is rejected with 409', async () => {
    const token = await registerAndGetToken();
    const res = await request(app).post('/api/v1/emergency/alert').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NO_PRIMARY_CONTACT');
  });

  test('a failed mail send still returns 200 with status failed', async () => {
    const token = await registerAndGetToken();
    await request(app)
      .post('/api/v1/emergency/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mom', email: 'mom@example.com' });

    mailer.sendMail.mockRejectedValueOnce(new Error('smtp down'));

    const res = await request(app).post('/api/v1/emergency/alert').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('failed');

    const [rows] = await pool.query('SELECT status, error_message FROM emergency_alerts');
    expect(rows[0].status).toBe('failed');
    expect(rows[0].error_message).toContain('smtp down');
  });

  test('a 4th alert within an hour is rate limited and still logged', async () => {
    const token = await registerAndGetToken();
    await request(app)
      .post('/api/v1/emergency/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mom', email: 'mom@example.com' });

    for (let i = 0; i < 3; i++) {
      await request(app).post('/api/v1/emergency/alert').set('Authorization', `Bearer ${token}`);
    }

    const res = await request(app).post('/api/v1/emergency/alert').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');

    const [rows] = await pool.query('SELECT status FROM emergency_alerts');
    expect(rows).toHaveLength(4);
    expect(rows.filter((r) => r.status === 'rate_limited')).toHaveLength(1);
  });

  test('an emergency contact is invisible outside the contacts endpoints', async () => {
    const token = await registerAndGetToken();
    await request(app)
      .post('/api/v1/emergency/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Mom', email: 'mom@example.com' });

    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(JSON.stringify(me.body)).not.toContain('mom@example.com');
  });
});
