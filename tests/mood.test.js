jest.mock('../src/config/mailer', () => require('./__mocks__/mailer'));

const request = require('supertest');
const app = require('../src/app');

function today() {
  return new Date().toISOString().slice(0, 10);
}

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function registerAndGetToken(email = 'user@example.com') {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ nickname: 'Test', email, password: 'password1' });
  return res.body.data.token;
}

describe('mood tracking', () => {
  test('logging mood for the first time today succeeds', async () => {
    const token = await registerAndGetToken();
    const res = await request(app)
      .post('/api/v1/mood')
      .set('Authorization', `Bearer ${token}`)
      .send({ moodLevel: 4, stressLevel: 2, sleepQuality: 3 });

    expect(res.status).toBe(201);
    expect(res.body.data.logDate).toBe(today());
    expect(res.body.data.moodLevel).toBe(4);
  });

  test('a second entry for the same day is rejected with 409', async () => {
    const token = await registerAndGetToken();
    await request(app)
      .post('/api/v1/mood')
      .set('Authorization', `Bearer ${token}`)
      .send({ moodLevel: 4, stressLevel: 2, sleepQuality: 3 });

    const res = await request(app)
      .post('/api/v1/mood')
      .set('Authorization', `Bearer ${token}`)
      .send({ moodLevel: 5, stressLevel: 1, sleepQuality: 5 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MOOD_ALREADY_LOGGED');
  });

  test('out-of-range level is rejected with 400', async () => {
    const token = await registerAndGetToken();
    const res = await request(app)
      .post('/api/v1/mood')
      .set('Authorization', `Bearer ${token}`)
      .send({ moodLevel: 9, stressLevel: 2, sleepQuality: 3 });
    expect(res.status).toBe(400);
  });

  test("today's entry can be edited", async () => {
    const token = await registerAndGetToken();
    await request(app)
      .post('/api/v1/mood')
      .set('Authorization', `Bearer ${token}`)
      .send({ moodLevel: 4, stressLevel: 2, sleepQuality: 3 });

    const res = await request(app)
      .patch(`/api/v1/mood/${today()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ moodLevel: 5, note: 'feeling better' });

    expect(res.status).toBe(200);
    expect(res.body.data.moodLevel).toBe(5);
    expect(res.body.data.note).toBe('feeling better');
  });

  test('editing a non-today date is rejected with 403', async () => {
    const token = await registerAndGetToken();
    const res = await request(app)
      .patch(`/api/v1/mood/${yesterday()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ moodLevel: 5 });

    expect(res.status).toBe(403);
  });

  test('a user cannot read another user mood logs', async () => {
    const tokenA = await registerAndGetToken('a@example.com');
    const tokenB = await registerAndGetToken('b@example.com');

    await request(app)
      .post('/api/v1/mood')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ moodLevel: 3, stressLevel: 3, sleepQuality: 3 });

    const res = await request(app).get('/api/v1/mood').set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  test('GET /mood?from=&to= filters by range', async () => {
    const token = await registerAndGetToken();
    await request(app)
      .post('/api/v1/mood')
      .set('Authorization', `Bearer ${token}`)
      .send({ moodLevel: 3, stressLevel: 3, sleepQuality: 3 });

    const inRange = await request(app)
      .get('/api/v1/mood')
      .query({ from: today(), to: today() })
      .set('Authorization', `Bearer ${token}`);
    expect(inRange.body.data).toHaveLength(1);

    const outOfRange = await request(app)
      .get('/api/v1/mood')
      .query({ from: '2000-01-01', to: '2000-01-02' })
      .set('Authorization', `Bearer ${token}`);
    expect(outOfRange.body.data).toHaveLength(0);
  });

  test('GET /mood/summary returns averages for the range', async () => {
    const token = await registerAndGetToken();
    await request(app)
      .post('/api/v1/mood')
      .set('Authorization', `Bearer ${token}`)
      .send({ moodLevel: 4, stressLevel: 2, sleepQuality: 3, sleepHours: 7.5 });

    const res = await request(app)
      .get('/api/v1/mood/summary')
      .query({ range: '7d' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].avgMood).toBe(4);
    expect(res.body.data[0].avgSleepHours).toBe(7.5);
    expect(res.body.data[0].entries).toBe(1);
  });

  test('unauthenticated requests to mood endpoints are rejected', async () => {
    const res = await request(app).get('/api/v1/mood');
    expect(res.status).toBe(401);
  });
});
