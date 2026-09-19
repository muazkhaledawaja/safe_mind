const { query } = require('../../config/db');
const { admin, anon } = require('../../config/supabase');
const { NotFoundError, ConflictError } = require('../../utils/errors');

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
    'SELECT id, nickname, full_name, email, role, is_active, created_at, auth_uid FROM users WHERE id = ?',
    [id]
  );
  if (!rows[0]) throw new NotFoundError('User not found');
  return rows[0];
}

async function getMe(id) {
  return toSelfView(await findById(id));
}

// True if the Supabase Auth account was created with an email/password
// identity (as opposed to a Google-only account that has no password).
async function hasPasswordIdentity(authUid) {
  const { data, error } = await admin.auth.admin.getUserById(authUid);
  if (error || !data.user) return false;
  return data.user.identities.some((identity) => identity.provider === 'email');
}

async function updateMe(id, updates) {
  const user = await findById(id); // 404s if the user doesn't exist

  // Password changes happen at the Supabase Auth layer, which owns the hash.
  if (updates.password) {
    if (await hasPasswordIdentity(user.auth_uid)) {
      // Google-only accounts are created by Supabase without a password and
      // skip the current-password check, mirroring the old password_hash logic.
      const { error } = await anon.auth.signInWithPassword({
        email: user.email,
        password: updates.currentPassword,
      });
      if (error) {
        throw new ConflictError('INVALID_PASSWORD', 'Current password is incorrect');
      }
    }
    await admin.auth.admin.updateUserById(user.auth_uid, { password: updates.password });
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

  if (fields.length > 0) {
    params.push(id);
    await query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
  }

  return getMe(id);
}

module.exports = { toSelfView, findById, getMe, updateMe };