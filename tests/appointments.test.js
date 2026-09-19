jest.mock('../src/config/mailer', () => require('./__mocks__/mailer'));

const request = require('supertest');
const app = require('../src/app');
const { query } = require('../src/config/db');
const mailer = require('./__mocks__/mailer');
const { registerAndLogin, createApprovedSpecialist } = require('./helpers');

function futureDate(hoursFromNow) {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
}

beforeEach(() => {
  mailer.sendMail.mockClear();
  mailer.sendMail.mockResolvedValue(true);
});

describe('specialists', () => {
  test('applying creates a pending specialist row, not yet listed publicly', async () => {
    const token = await registerAndLogin('applicant@example.com');
    const res = await request(app)
      .post('/api/v1/specialists/apply')
      .set('Authorization', `Bearer ${token}`)
      .send({ specialization: 'trauma' });

    expect(res.status).toBe(201);
    expect(res.body.data.verificationStatus).toBe('pending');

    const list = await request(app).get('/api/v1/specialists');
    expect(list.body.data).toHaveLength(0);
  });

  test('an approved specialist appears in the public listing, filterable by specialization', async () => {
    const { specialistId } = await createApprovedSpecialist();

    const list = await request(app).get('/api/v1/specialists').query({ specialization: 'anxiety' });
    expect(list.body.data.map((s) => s.id)).toContain(specialistId);

    const wrongFilter = await request(app).get('/api/v1/specialists').query({ specialization: 'sleep' });
    expect(wrongFilter.body.data).toHaveLength(0);
  });

  test('applying twice is rejected', async () => {
    const token = await registerAndLogin('twice@example.com');
    await request(app)
      .post('/api/v1/specialists/apply')
      .set('Authorization', `Bearer ${token}`)
      .send({ specialization: 'anxiety' });

    const res = await request(app)
      .post('/api/v1/specialists/apply')
      .set('Authorization', `Bearer ${token}`)
      .send({ specialization: 'sleep' });

    expect(res.status).toBe(409);
  });
});

describe('appointments', () => {
  test('booking an unapproved specialist is refused', async () => {
    const specialistToken = await registerAndLogin('pending-spec@example.com');
    const applyRes = await request(app)
      .post('/api/v1/specialists/apply')
      .set('Authorization', `Bearer ${specialistToken}`)
      .send({ specialization: 'anxiety' });

    const userToken = await registerAndLogin('booker@example.com');
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ specialistId: applyRes.body.data.id, scheduledAt: futureDate(24) });

    expect(res.status).toBe(403);
  });

  test('a user can book an approved specialist; status starts pending', async () => {
    const { specialistId } = await createApprovedSpecialist();
    const userToken = await registerAndLogin('booker2@example.com');

    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ specialistId, scheduledAt: futureDate(24) });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
    expect(mailer.sendMail).toHaveBeenCalled();
  });

  test('specialist accepting opens a conversation', async () => {
    const { token: specToken, specialistId } = await createApprovedSpecialist();
    const userToken = await registerAndLogin('booker3@example.com');

    const bookRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ specialistId, scheduledAt: futureDate(24) });

    const respondRes = await request(app)
      .patch(`/api/v1/appointments/${bookRes.body.data.id}/respond`)
      .set('Authorization', `Bearer ${specToken}`)
      .send({ decision: 'accepted' });

    expect(respondRes.status).toBe(200);
    expect(respondRes.body.data.status).toBe('accepted');

    const conversations = await request(app)
      .get('/api/v1/conversations')
      .set('Authorization', `Bearer ${userToken}`);
    expect(conversations.body.data).toHaveLength(1);
  });

  test('overlapping accepted appointments are rejected with APPOINTMENT_CONFLICT', async () => {
    const { token: specToken, specialistId } = await createApprovedSpecialist();
    const userA = await registerAndLogin('userA@example.com');
    const userB = await registerAndLogin('userB@example.com');
    const slot = futureDate(24);

    const bookA = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${userA}`)
      .send({ specialistId, scheduledAt: slot });
    await request(app)
      .patch(`/api/v1/appointments/${bookA.body.data.id}/respond`)
      .set('Authorization', `Bearer ${specToken}`)
      .send({ decision: 'accepted' });

    const bookB = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${userB}`)
      .send({ specialistId, scheduledAt: slot });
    const respondB = await request(app)
      .patch(`/api/v1/appointments/${bookB.body.data.id}/respond`)
      .set('Authorization', `Bearer ${specToken}`)
      .send({ decision: 'accepted' });

    expect(respondB.status).toBe(409);
    expect(respondB.body.error.code).toBe('APPOINTMENT_CONFLICT');
  });

  test('a conversation cannot be opened without an accepted appointment', async () => {
    const { specialistId } = await createApprovedSpecialist();
    const userToken = await registerAndLogin('nobooking@example.com');

    const res = await request(app)
      .get('/api/v1/conversations')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.body.data).toHaveLength(0);
  });

  test('either party can cancel before the appointment starts', async () => {
    const { specialistId } = await createApprovedSpecialist();
    const userToken = await registerAndLogin('canceller@example.com');

    const bookRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ specialistId, scheduledAt: futureDate(48) });

    const res = await request(app)
      .patch(`/api/v1/appointments/${bookRes.body.data.id}/cancel`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('cancelled');
  });
});

describe('messages', () => {
  async function acceptedAppointment() {
    const { token: specToken, specialistId } = await createApprovedSpecialist();
    const userToken = await registerAndLogin('chatuser@example.com');
    const bookRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ specialistId, scheduledAt: futureDate(24) });
    await request(app)
      .patch(`/api/v1/appointments/${bookRes.body.data.id}/respond`)
      .set('Authorization', `Bearer ${specToken}`)
      .send({ decision: 'accepted' });

    const conversations = await request(app)
      .get('/api/v1/conversations')
      .set('Authorization', `Bearer ${userToken}`);
    return { userToken, specToken, conversationId: conversations.body.data[0].id };
  }

  test('a participant can send and read messages', async () => {
    const { userToken, specToken, conversationId } = await acceptedAppointment();

    const sendRes = await request(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ body: 'Hello, I need help' });
    expect(sendRes.status).toBe(201);

    const listRes = await request(app)
      .get(`/api/v1/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${specToken}`);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].body).toBe('Hello, I need help');
  });

  test('a third party with a valid token gets 403 on someone else conversation', async () => {
    const { conversationId } = await acceptedAppointment();
    const outsiderToken = await registerAndLogin('outsider@example.com');

    const res = await request(app)
      .get(`/api/v1/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(res.status).toBe(403);
  });

  test('marking a message read updates the unread count', async () => {
    const { userToken, specToken, conversationId } = await acceptedAppointment();

    const sendRes = await request(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ body: 'Are you there?' });

    const before = await request(app)
      .get('/api/v1/conversations/unread-count')
      .set('Authorization', `Bearer ${specToken}`);
    expect(before.body.data.count).toBe(1);

    await request(app)
      .patch(`/api/v1/messages/${sendRes.body.data.id}/read`)
      .set('Authorization', `Bearer ${specToken}`);

    const after = await request(app)
      .get('/api/v1/conversations/unread-count')
      .set('Authorization', `Bearer ${specToken}`);
    expect(after.body.data.count).toBe(0);
  });
});
