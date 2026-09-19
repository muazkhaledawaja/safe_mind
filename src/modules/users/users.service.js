const bcrypt = require('bcrypt');
const { query } = require('../../config/db');
const { NotFoundError, ConflictError } = require('../../utils/errors');

const BCRYPT_COST = 12;

// Maps a raw `users` row to the self-view shape. fullName only ever appears
// here — never in any endpoint that returns another user (CLAUDE.md rule 7).
function toSelfView(row) {
  return {
    id: row.id,
    nickname: row.nickname,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    isActive: !!row.is_active,
    createdAt: row.created_at,
  };
}

async function findById(id) {
  const rows = await query(
    'SELECT id, nickname, full_name, email, role, is_active, created_at FROM users WHERE id = ?',
    [id]
  );
  if (!rows[0]) throw new NotFoundError('User not found');
  return rows[0];
}

async function getMe(id) {
  return toSelfView(await findById(id));
}

async function updateMe(id, updates) {
  await findById(id); // 404s if the user doesn't exist

  if (updates.password) {
    // password_hash isn't selected by findById; fetch it separately to keep
    // the hash out of every other query in this file.
    const [{ password_hash }] = await query('SELECT password_hash FROM users WHERE id = ?', [id]);
    // Google-only accounts have no password_hash yet — first password set skips the check.
    if (password_hash) {
      const ok = await bcrypt.compare(updates.currentPassword, password_hash);
      if (!ok) throw new ConflictError('INVALID_PASSWORD', 'Current password is incorrect');
    }
  }

  const fields = [];
  const params = [];
  if (updates.nickname !== undefined) {
    fields.push('nickname = ?');
    params.push(updates.nickname);
  }
  if (updates.fullName !== undefined) {
    fields.push('full_name = ?');
    params.push(updates.fullName);
  }
  if (updates.password) {
    fields.push('password_hash = ?');
    params.push(await bcrypt.hash(updates.password, BCRYPT_COST));
  }

  if (fields.length > 0) {
    params.push(id);
    await query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  return getMe(id);
}

module.exports = { toSelfView, findById, getMe, updateMe, BCRYPT_COST };
