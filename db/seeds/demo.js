// Mock data covering every module, for manually exercising all 35 endpoints
// via Postman/Swagger without registering accounts by hand.
// Run with: node db/seeds/demo.js — safe to re-run, every insert is guarded
// by an existence check.
require('dotenv').config();
const bcrypt = require('bcrypt');
const { pool, query } = require('../../src/config/db');

const DEMO_PASSWORD = 'password123';

async function ensureUser({ nickname, email, role = 'user', fullName = null }) {
  const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length > 0) {
    if (role !== 'user') await query('UPDATE users SET role = ? WHERE id = ?', [role, existing[0].id]);
    return existing[0].id;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const result = await query(
    'INSERT INTO users (nickname, full_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    [nickname, fullName, email, passwordHash, role]
  );
  return result.insertId;
}

async function ensureSpecialist(userId, { specialization, status, adminId, bio = null, years = 5 }) {
  const existing = await query('SELECT id FROM specialists WHERE user_id = ?', [userId]);
  if (existing.length > 0) return existing[0].id;

  const result = await query(
    `INSERT INTO specialists (user_id, specialization, bio, years_experience, verification_status, verified_by, verified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      specialization,
      bio,
      years,
      status,
      status === 'pending' ? null : adminId,
      status === 'pending' ? null : new Date(),
    ]
  );
  return result.insertId;
}

async function ensureArticle({ categorySlug, authorId, title, slug, excerpt, content, status }) {
  const existing = await query('SELECT id FROM articles WHERE slug = ?', [slug]);
  if (existing.length > 0) return existing[0].id;

  const [category] = await query('SELECT id FROM categories WHERE slug = ?', [categorySlug]);
  if (!category) return null;

  const result = await query(
    `INSERT INTO articles (category_id, author_id, title, slug, excerpt, content, status, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [category.id, authorId, title, slug, excerpt, content, status, status === 'published' ? new Date() : null]
  );
  return result.insertId;
}

async function ensureMoodLog(userId, { daysAgo, moodLevel, stressLevel, sleepQuality, sleepHours, note }) {
  const logDate = new Date();
  logDate.setDate(logDate.getDate() - daysAgo);
  const dateStr = logDate.toISOString().slice(0, 10);

  const existing = await query('SELECT id FROM mood_logs WHERE user_id = ? AND log_date = ?', [userId, dateStr]);
  if (existing.length > 0) return existing[0].id;

  const result = await query(
    `INSERT INTO mood_logs (user_id, log_date, mood_level, stress_level, sleep_quality, sleep_hours, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, dateStr, moodLevel, stressLevel, sleepQuality, sleepHours, note]
  );
  return result.insertId;
}

async function ensureEmergencyContact(userId, { name, email, phone, relationship, isPrimary }) {
  const existing = await query('SELECT id FROM emergency_contacts WHERE user_id = ? AND email = ?', [
    userId,
    email,
  ]);
  if (existing.length > 0) return existing[0].id;

  const result = await query(
    `INSERT INTO emergency_contacts (user_id, name, phone, email, relationship, is_primary)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, name, phone, email, relationship, isPrimary]
  );
  return result.insertId;
}

// Keyed on (user, specialist, status) rather than the computed scheduled_at
// — the demo only ever wants one appointment of each status per pair, and
// scheduled_at is relative to "now" so it drifts on every run.
async function ensureAppointment({ userId, specialistId, hoursFromNow, durationMin, status, userNote }) {
  const existing = await query(
    'SELECT id FROM appointments WHERE user_id = ? AND specialist_id = ? AND status = ?',
    [userId, specialistId, status]
  );
  if (existing.length > 0) return existing[0].id;

  const scheduledAt = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);

  const result = await query(
    `INSERT INTO appointments (user_id, specialist_id, scheduled_at, duration_min, status, user_note, responded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      specialistId,
      scheduledAt,
      durationMin,
      status,
      userNote,
      status === 'pending' ? null : new Date(),
    ]
  );
  return result.insertId;
}

async function ensureConversation({ userId, specialistId, appointmentId }) {
  const existing = await query('SELECT id FROM conversations WHERE user_id = ? AND specialist_id = ?', [
    userId,
    specialistId,
  ]);
  if (existing.length > 0) return existing[0].id;

  const result = await query(
    'INSERT INTO conversations (user_id, specialist_id, appointment_id) VALUES (?, ?, ?)',
    [userId, specialistId, appointmentId]
  );
  return result.insertId;
}

async function ensureMessage({ conversationId, senderId, body, isRead = false }) {
  const existing = await query(
    'SELECT id FROM messages WHERE conversation_id = ? AND sender_id = ? AND body = ?',
    [conversationId, senderId, body]
  );
  if (existing.length > 0) return existing[0].id;

  const result = await query(
    'INSERT INTO messages (conversation_id, sender_id, body, is_read, read_at) VALUES (?, ?, ?, ?, ?)',
    [conversationId, senderId, body, isRead, isRead ? new Date() : null]
  );
  await query('UPDATE conversations SET last_message_at = NOW() WHERE id = ?', [conversationId]);
  return result.insertId;
}

async function run() {
  // --- Users -----------------------------------------------------------
  const adminId = await ensureUser({ nickname: 'Admin', email: 'admin@safemind.demo', role: 'admin' });

  const specUser1Id = await ensureUser({
    nickname: 'Dr. Layla',
    fullName: 'Layla Hassan',
    email: 'specialist@safemind.demo',
    role: 'specialist',
  });
  const specUser2Id = await ensureUser({
    nickname: 'Dr. Omar',
    fullName: 'Omar Saeed',
    email: 'specialist2@safemind.demo',
    role: 'specialist',
  });
  const pendingSpecUserId = await ensureUser({
    nickname: 'Dr. Nadia',
    email: 'pending-specialist@safemind.demo',
    role: 'user', // stays 'user' until an admin approves the application below
  });

  const userId = await ensureUser({ nickname: 'Demo User', email: 'user@safemind.demo', role: 'user' });
  const inactiveUserId = await ensureUser({
    nickname: 'Deactivated User',
    email: 'inactive@safemind.demo',
    role: 'user',
  });

  // --- Specialists -------------------------------------------------------
  const spec1Id = await ensureSpecialist(specUser1Id, {
    specialization: 'Anxiety',
    status: 'approved',
    adminId,
    bio: 'Demo specialist account for examiners.',
  });
  const spec2Id = await ensureSpecialist(specUser2Id, {
    specialization: 'Sleep',
    status: 'approved',
    adminId,
    bio: 'Second demo specialist, different specialization, for filter testing.',
  });
  const pendingSpecId = await ensureSpecialist(pendingSpecUserId, {
    specialization: 'Trauma and War',
    status: 'pending',
    adminId,
    bio: 'Awaiting admin review — use PATCH /admin/specialists/:id/verify to approve or reject.',
    years: 2,
  });

  // Deactivate one user so GET /admin/users and the ACCOUNT_INACTIVE login
  // path both have something real to show.
  await query('UPDATE users SET is_active = 0 WHERE id = ?', [inactiveUserId]);

  // --- Categories + articles ----------------------------------------------
  await ensureArticle({
    categorySlug: 'anxiety',
    authorId: adminId,
    title: 'Managing Anxiety: A Starting Point',
    slug: 'demo-managing-anxiety',
    excerpt: 'A short introduction to grounding techniques.',
    content: 'مقال تجريبي عن كيفية التعامل مع القلق باستخدام تقنيات التأريض والتنفس.',
    status: 'published',
  });
  await ensureArticle({
    categorySlug: 'sleep',
    authorId: adminId,
    title: 'Improving Sleep Quality',
    slug: 'demo-sleep-quality',
    excerpt: 'Simple habits for better sleep.',
    content: 'Placeholder demo content about sleep hygiene, for search and pagination testing.',
    status: 'published',
  });
  await ensureArticle({
    categorySlug: 'self-care',
    authorId: adminId,
    title: 'Draft: Self Care Basics (unpublished)',
    slug: 'demo-self-care-draft',
    excerpt: 'Still being written.',
    content: 'This draft should be invisible on GET /articles and visible only on GET /articles/admin.',
    status: 'draft',
  });

  // --- Mood logs (demo user, last 5 days) --------------------------------
  await ensureMoodLog(userId, { daysAgo: 4, moodLevel: 3, stressLevel: 3, sleepQuality: 3, sleepHours: 6.5, note: 'Average day' });
  await ensureMoodLog(userId, { daysAgo: 3, moodLevel: 2, stressLevel: 4, sleepQuality: 2, sleepHours: 5.0, note: 'Stressful day at work' });
  await ensureMoodLog(userId, { daysAgo: 2, moodLevel: 4, stressLevel: 2, sleepQuality: 4, sleepHours: 7.5, note: null });
  await ensureMoodLog(userId, { daysAgo: 1, moodLevel: 4, stressLevel: 2, sleepQuality: 4, sleepHours: 8.0, note: 'Feeling better' });
  // Today's entry intentionally omitted so POST /mood and PATCH /mood/:date
  // (today only) both have something to exercise manually.

  // --- Emergency contacts (demo user) -------------------------------------
  await ensureEmergencyContact(userId, {
    name: 'Mom',
    email: 'mom@safemind.demo',
    phone: '+201000000001',
    relationship: 'Parent',
    isPrimary: true,
  });
  await ensureEmergencyContact(userId, {
    name: 'Best Friend',
    email: 'friend@safemind.demo',
    phone: '+201000000002',
    relationship: 'Friend',
    isPrimary: false,
  });

  // --- Appointments (all statuses, for the conflict rule and cancel flow) -
  const acceptedAppt = await ensureAppointment({
    userId,
    specialistId: spec1Id,
    hoursFromNow: 48,
    durationMin: 45,
    status: 'accepted',
    userNote: 'Would like to talk about work stress.',
  });
  await ensureAppointment({
    userId,
    specialistId: spec2Id,
    hoursFromNow: 24,
    durationMin: 30,
    status: 'pending',
    userNote: 'First-time consultation request.',
  });
  await ensureAppointment({
    userId,
    specialistId: spec1Id,
    hoursFromNow: -48,
    durationMin: 45,
    status: 'completed',
    userNote: 'Past session, already completed.',
  });
  await ensureAppointment({
    userId,
    specialistId: spec1Id,
    hoursFromNow: 72,
    durationMin: 45,
    status: 'rejected',
    userNote: 'Requested a slot the specialist declined.',
  });

  // --- Conversation + messages (only exists because of the accepted appointment above) --
  const conversationId = await ensureConversation({ userId, specialistId: spec1Id, appointmentId: acceptedAppt });
  await ensureMessage({ conversationId, senderId: userId, body: 'Hi doctor, looking forward to our session.', isRead: true });
  await ensureMessage({ conversationId, senderId: specUser1Id, body: 'Looking forward to it too. See you then.', isRead: false });

  console.log('\nDemo accounts (all password: ' + DEMO_PASSWORD + ')');
  console.table([
    { role: 'admin', email: 'admin@safemind.demo', id: adminId },
    { role: 'specialist (approved, Anxiety)', email: 'specialist@safemind.demo', id: specUser1Id },
    { role: 'specialist (approved, Sleep)', email: 'specialist2@safemind.demo', id: specUser2Id },
    { role: 'user (pending specialist application)', email: 'pending-specialist@safemind.demo', id: pendingSpecUserId },
    { role: 'user', email: 'user@safemind.demo', id: userId },
    { role: 'user (deactivated)', email: 'inactive@safemind.demo', id: inactiveUserId },
  ]);
  console.log(`pending specialist application id: ${pendingSpecId} (PATCH /admin/specialists/${pendingSpecId}/verify)`);
  console.log(`accepted appointment id: ${acceptedAppt} (conversation id: ${conversationId})`);
  console.log('demo seed complete');
}

run()
  .catch((err) => {
    console.error('demo seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
