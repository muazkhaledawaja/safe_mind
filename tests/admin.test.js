jest.mock('../src/config/mailer', () => require('./__mocks__/mailer'));

const request = require('supertest');
const app = require('../src/app');
const { query } = require('../src/config/db');
const mailer = require('./__mocks__/mailer');

async function registerAndLogin(email, password = 'password1') {
  await request(app).post('/api/v1/auth/register').send({ nickname: 'Test', email, password });
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  return res.body.data.token;
}

async function adminToken(email = 'admin@example.com') {
  const token = await registerAndLogin(email);
  await query('UPDATE users SET role = ? WHERE email = ?', ['admin', email]);
  return registerAndLogin(email); // re-login to pick up the new role in the JWT
}

beforeEach(() => {
  mailer.sendMail.mockClear();
  mailer.sendMail.mockResolvedValue(true);
});

describe('admin: users', () => {
  test('non-admin is rejected with 403', async () => {
    const token = await registerAndLogin('plain@example.com');
    const res = await request(app).get('/api/v1/admin/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('admin can list users', async () => {
    const admin = await adminToken();
    await registerAndLogin('someone@example.com');

    const res = await request(app).get('/api/v1/admin/users').set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
  });

  test('deactivating a user is audited', async () => {
    const admin = await adminToken();
    await request(app).post('/api/v1/auth/register').send({
      nickname: 'Target',
      email: 'target@example.com',
      password: 'password1',
    });
    const [targetRow] = await query('SELECT id FROM users WHERE email = ?', ['target@example.com']);

    const res = await request(app)
      .patch(`/api/v1/admin/users/${targetRow.id}/status`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);

    const [logRow] = await query('SELECT action, entity_id FROM audit_logs WHERE action = ?', ['user_deactivate']);
    expect(logRow.entity_id).toBe(targetRow.id);
  });

  test('a deactivated user cannot log in', async () => {
    const admin = await adminToken();
    await request(app).post('/api/v1/auth/register').send({
      nickname: 'Deactivated',
      email: 'deactivated@example.com',
      password: 'password1',
    });
    const [targetRow] = await query('SELECT id FROM users WHERE email = ?', ['deactivated@example.com']);
    await request(app)
      .patch(`/api/v1/admin/users/${targetRow.id}/status`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ isActive: false });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'deactivated@example.com', password: 'password1' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
  });
});

describe('admin: specialists', () => {
  test('approving flips the applicant role to specialist and is audited', async () => {
    const admin = await adminToken();
    const applicantToken = await registerAndLogin('applicant@example.com');
    const applyRes = await request(app)
      .post('/api/v1/specialists/apply')
      .set('Authorization', `Bearer ${applicantToken}`)
      .send({ specialization: 'anxiety' });

    const res = await request(app)
      .patch(`/api/v1/admin/specialists/${applyRes.body.data.id}/verify`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ decision: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.data.verificationStatus).toBe('approved');
    expect(mailer.sendMail).toHaveBeenCalled();

    const [userRow] = await query('SELECT role FROM users WHERE email = ?', ['applicant@example.com']);
    expect(userRow.role).toBe('specialist');

    const [logRow] = await query('SELECT action FROM audit_logs WHERE action = ?', ['specialist_approved']);
    expect(logRow).toBeTruthy();
  });

  test('rejecting requires a reason and does not change the role', async () => {
    const admin = await adminToken();
    const applicantToken = await registerAndLogin('rejectme@example.com');
    const applyRes = await request(app)
      .post('/api/v1/specialists/apply')
      .set('Authorization', `Bearer ${applicantToken}`)
      .send({ specialization: 'anxiety' });

    const missingReason = await request(app)
      .patch(`/api/v1/admin/specialists/${applyRes.body.data.id}/verify`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ decision: 'rejected' });
    expect(missingReason.status).toBe(400);

    const res = await request(app)
      .patch(`/api/v1/admin/specialists/${applyRes.body.data.id}/verify`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ decision: 'rejected', rejectionReason: 'Missing license' });
    expect(res.status).toBe(200);
    expect(res.body.data.verificationStatus).toBe('rejected');

    const [userRow] = await query('SELECT role FROM users WHERE email = ?', ['rejectme@example.com']);
    expect(userRow.role).toBe('user');
  });

  test('reviewing an already-reviewed application is rejected', async () => {
    const admin = await adminToken();
    const applicantToken = await registerAndLogin('twice2@example.com');
    const applyRes = await request(app)
      .post('/api/v1/specialists/apply')
      .set('Authorization', `Bearer ${applicantToken}`)
      .send({ specialization: 'anxiety' });

    await request(app)
      .patch(`/api/v1/admin/specialists/${applyRes.body.data.id}/verify`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ decision: 'approved' });

    const res = await request(app)
      .patch(`/api/v1/admin/specialists/${applyRes.body.data.id}/verify`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ decision: 'approved' });
    expect(res.status).toBe(409);
  });
});

describe('admin: stats and audit logs', () => {
  test('stats returns counts', async () => {
    const admin = await adminToken();
    const res = await request(app).get('/api/v1/admin/stats').set('Authorization', `Bearer ${admin}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('totalUsers');
    expect(res.body.data).toHaveProperty('appointmentsByStatus');
    expect(res.body.data).toHaveProperty('emergencyAlertsLast30Days');
  });

  test('audit logs are filterable by action', async () => {
    const admin = await adminToken();
    await request(app).post('/api/v1/auth/register').send({
      nickname: 'Filtered',
      email: 'filtered@example.com',
      password: 'password1',
    });
    const [targetRow] = await query('SELECT id FROM users WHERE email = ?', ['filtered@example.com']);
    await request(app)
      .patch(`/api/v1/admin/users/${targetRow.id}/status`)
      .set('Authorization', `Bearer ${admin}`)
      .send({ isActive: false });

    const res = await request(app)
      .get('/api/v1/admin/audit-logs')
      .query({ action: 'user_deactivate' })
      .set('Authorization', `Bearer ${admin}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.every((log) => log.action === 'user_deactivate')).toBe(true);
  });
});
