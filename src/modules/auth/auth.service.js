const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { query } = require('../../config/db');
const { admin, anon } = require('../../config/supabase');
const env = require('../../config/env');
const { sendMail } = require('../../config/mailer');
const { ConflictError, UnauthorizedError, AppError } = require('../../utils/errors');
const { toSelfView, getMe } = require('../users/users.service');
const logger = require('../../utils/logger');

const googleClient = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

async function findByEmail(email) {
  const rows = await query('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0] || null;
}

async function findByAuthUid(authUid) {
  const rows = await query('SELECT * FROM users WHERE auth_uid = ?', [authUid]);
  return rows[0] || null;
}

// Exchanges an email/password pair for a real Supabase Auth session (and so a
// token the frontend can use both for REST and Realtime). Passwords are
// verified and hashed by Supabase Auth — never by this API.
async function createSession(email, password) {
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error) throw new UnauthorizedError('Invalid email or password');
  return data.session;
}

async function register({ nickname, fullName, email, password }) {
  const existing = await findByEmail(email);
  if (existing) {
    throw new ConflictError('EMAIL_TAKEN', 'An account with this email already exists');
  }

  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    throw new ConflictError('EMAIL_TAKEN', 'An account with this email already exists');
  }

  const result = await query(
    'INSERT INTO users (nickname, full_name, email, role, auth_uid) VALUES (?, ?, ?, ?, ?) RETURNING id',
    [nickname, fullName || null, email, 'user', data.user.id]
  );

  const session = await createSession(email, password);
  const user = await getMe(result[0].id);
  return { user, token: session.access_token };
}

async function login({ email, password }) {
  const session = await createSession(email, password);

  const row = await findByAuthUid(session.user.id);
  // A valid Supabase account with no linked Safe Mind profile is not a usable login.
  if (!row) throw new UnauthorizedError('Invalid email or password');
  if (!row.is_active) throw new AppError(403, 'ACCOUNT_INACTIVE', 'This account has been deactivated');

  await query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [row.id]);

  return { user: toSelfView(row), token: session.access_token };
}

async function forgotPassword({ email }) {
  const rows = await query('SELECT id, nickname FROM users WHERE email = ?', [email]);
  const row = rows[0];

  // Always behave the same whether the email exists or not, to avoid
  // leaking which addresses are registered.
  if (row) {
    const token = crypto.randomBytes(32).toString('hex');
    await query(
      'UPDATE users SET reset_token = ?, reset_expires = NOW() + interval \'1 hour\' WHERE id = ?',
      [token, row.id]
    );

    try {
      await sendMail({
        to: email,
        subject: 'Reset your Safe Mind password',
        text: `Reset your password: ${env.APP_URL}/reset-password?token=${token}`,
      });
    } catch (err) {
      // Never let a mail-provider outage reveal account existence via a
      // different response shape — just log and keep the generic 200.
      logger.error('forgot_password_mail_failed', { userId: row.id });
    }
  }

  return { message: 'If that email is registered, a reset link has been sent.' };
}

async function resetPassword({ token, password }) {
  const rows = await query(
    'SELECT id, auth_uid FROM users WHERE reset_token = ? AND reset_expires > NOW()',
    [token]
  );
  const row = rows[0];
  if (!row) throw new AppError(400, 'INVALID_TOKEN', 'This reset link is invalid or has expired');

  // The new hash lives at Supabase Auth; our users table only stores the
  // one-time reset token.
  const { error } = await admin.auth.admin.updateUserById(row.auth_uid, { password });
  if (error) throw new AppError(500, 'INTERNAL_ERROR', 'Unable to reset password');

  await query(
    'UPDATE users SET reset_token = NULL, reset_expires = NULL WHERE id = ?',
    [row.id]
  );

  return { message: 'Password has been reset. You can now log in.' };
}

async function google({ idToken }) {
  // Supabase verifies the Google ID token and provisions/signs in the Auth user.
  const { data, error } = await anon.auth.signInWithIdToken({ provider: 'google', token: idToken });
  if (error) {
    // The most common failure is a password account already holding this
    // email. Recover by linking the Google identity to that account — but we
    // need the verified email first, so decode the id_token ourselves.
    const payload = await verifyGoogleToken(idToken);
    const existing = payload ? await findByEmail(payload.email) : null;
    if (existing && existing.auth_uid) {
      const linked = await admin.auth.admin.linkIdentity({
        userId: existing.auth_uid,
        provider: 'google',
        idToken,
      });
      if (!linked.error) {
        // Re-exchange now that the identity is linked.
        const retry = await anon.auth.signInWithIdToken({ provider: 'google', token: idToken });
        if (!retry.error) return finalizeGoogleSession(retry.data);
      }
    }
    throw new UnauthorizedError('Invalid Google token');
  }

  return finalizeGoogleSession(data);
}

async function verifyGoogleToken(idToken) {
  if (!googleClient) return null;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
    return ticket.getPayload();
  } catch {
    return null;
  }
}

async function finalizeGoogleSession({ user: authUser, session }) {
  let row = await findByAuthUid(authUser.id);
  if (!row) {
    const existing = await findByEmail(authUser.email);
    if (existing) {
      // A Safe Mind profile exists for this email but was never linked to a
      // Supabase Auth account — link it now.
      const updated = await query(
        'UPDATE users SET auth_uid = ? WHERE id = ? RETURNING *',
        [authUser.id, existing.id]
      );
      row = updated[0];
    } else {
      const nickname = (authUser.user_metadata.name || authUser.email.split('@')[0]).slice(0, 50);
      const inserted = await query(
        'INSERT INTO users (nickname, email, role, auth_uid) VALUES (?, ?, ?, ?) RETURNING *',
        [nickname, authUser.email, 'user', authUser.id]
      );
      row = inserted[0];
    }
  }

  if (!row.is_active) throw new AppError(403, 'ACCOUNT_INACTIVE', 'This account has been deactivated');

  await query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [row.id]);

  return { user: toSelfView(row), token: session.access_token };
}

module.exports = { register, login, forgotPassword, resetPassword, google, createSession };