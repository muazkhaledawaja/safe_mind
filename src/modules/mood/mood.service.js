const { query } = require('../../config/db');
const { NotFoundError, ConflictError, ForbiddenError } = require('../../utils/errors');

function toView(row) {
  return {
    id: row.id,
    logDate: toDateString(row.log_date),
    moodLevel: row.mood_level,
    stressLevel: row.stress_level,
    sleepQuality: row.sleep_quality,
    sleepHours: row.sleep_hours === null ? null : Number(row.sleep_hours),
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// pg returns DATE as a string and TIMESTAMPTZ as a Date. Format either into a
// 'YYYY-MM-DD' key. For Date inputs use local getters, not toISOString()
// (which converts to UTC and can shift the date by a day).
function toDateString(date) {
  if (typeof date === 'string') return date.slice(0, 10);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function today() {
  return toDateString(new Date());
}

async function create(userId, data) {
  const logDate = today();

  const existing = await query('SELECT id FROM mood_logs WHERE user_id = ? AND log_date = ?', [
    userId,
    logDate,
  ]);
  if (existing.length > 0) {
    throw new ConflictError('MOOD_ALREADY_LOGGED', 'You already logged your mood today');
  }

  await query(
    `INSERT INTO mood_logs (user_id, log_date, mood_level, stress_level, sleep_quality, sleep_hours, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, logDate, data.moodLevel, data.stressLevel, data.sleepQuality, data.sleepHours ?? null, data.note ?? null]
  );

  return toView(await findOwnByDate(userId, logDate));
}

async function findOwnByDate(userId, logDate) {
  const rows = await query('SELECT * FROM mood_logs WHERE user_id = ? AND log_date = ?', [userId, logDate]);
  if (!rows[0]) throw new NotFoundError('No mood entry for that date');
  return rows[0];
}

// Editing is only ever allowed for today's own entry — CLAUDE.md Phase 4:
// "edit today's entry only". A user cannot backdate an edit by passing an
// old date, even their own.
async function update(userId, requestedDate, updates) {
  if (requestedDate !== today()) {
    throw new ForbiddenError('Only today\'s mood entry can be edited');
  }

  const current = await findOwnByDate(userId, requestedDate);

  const fields = [];
  const params = [];
  if (updates.moodLevel !== undefined) { fields.push('mood_level = ?'); params.push(updates.moodLevel); }
  if (updates.stressLevel !== undefined) { fields.push('stress_level = ?'); params.push(updates.stressLevel); }
  if (updates.sleepQuality !== undefined) { fields.push('sleep_quality = ?'); params.push(updates.sleepQuality); }
  if (updates.sleepHours !== undefined) { fields.push('sleep_hours = ?'); params.push(updates.sleepHours); }
  if (updates.note !== undefined) { fields.push('note = ?'); params.push(updates.note); }

  if (fields.length > 0) {
    params.push(current.id);
    await query(`UPDATE mood_logs SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  return toView(await findOwnByDate(userId, requestedDate));
}

// Own rows only — enforced by user_id in every query, never by trusting a
// caller-supplied id.
async function listRange(userId, { from, to }) {
  const conditions = ['user_id = ?'];
  const params = [userId];
  if (from) { conditions.push('log_date >= ?'); params.push(from); }
  if (to) { conditions.push('log_date <= ?'); params.push(to); }

  const rows = await query(
    `SELECT * FROM mood_logs WHERE ${conditions.join(' AND ')} ORDER BY log_date DESC`,
    params
  );
  return rows.map(toView);
}

const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 };

async function summary(userId, { range, groupBy }) {
  const days = RANGE_DAYS[range];
  const bucketExpr = groupBy === 'week' ? 'date_trunc(\'week\', log_date)' : 'log_date';

  const rows = await query(
    `SELECT
       ${bucketExpr} AS bucket,
       MIN(log_date) AS bucket_start,
       COUNT(*) AS entries,
       AVG(mood_level) AS avg_mood,
       AVG(stress_level) AS avg_stress,
       AVG(sleep_quality) AS avg_sleep_quality,
       AVG(sleep_hours) AS avg_sleep_hours
     FROM mood_logs
     WHERE user_id = ? AND log_date >= CURRENT_DATE - (?::int * interval '1 day')
     GROUP BY bucket
     ORDER BY bucket_start ASC`,
    [userId, days]
  );

  return rows.map((row) => ({
    period: toDateString(row.bucket_start),
    entries: row.entries,
    avgMood: round1(row.avg_mood),
    avgStress: round1(row.avg_stress),
    avgSleepQuality: round1(row.avg_sleep_quality),
    avgSleepHours: row.avg_sleep_hours === null ? null : round1(row.avg_sleep_hours),
  }));
}

function round1(value) {
  return value === null ? null : Math.round(Number(value) * 10) / 10;
}

module.exports = { create, update, listRange, summary, findOwnByDate };
