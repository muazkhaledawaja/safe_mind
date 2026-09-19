const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { query } = require('../../config/db');
const env = require('../../config/env');
const { sendMail } = require('../../config/mailer');
const { ConflictError, UnauthorizedError, AppError } = require('../../utils/errors');
const { toSelfView, BCRYPT_COST, getMe } = require('../users/users.service');
const logger = require('../../utils/logger');

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

async function register({ nickname, fullName, email, password }) {
  const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length > 0) {
    throw new ConflictError('EMAIL_TAKEN', 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const result = await query(
    'INSERT INTO users (nickname, full_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    [nickname, fullName || null, email, passwordHash, 'user']
  );

  const user = await getMe(result.insertId);
  return { user, token: signToken(user) };
}

async function login({ email, password }) {
  const rows = await query(
    'SELECT id, nickname, full_name, email, password_hash, role, is_active, created_at FROM users WHERE email = ?',
    [email]
  );
  const row = rows[0];
  // Same error for unknown email and wrong password — don't leak which one failed.
  if (!row) throw new UnauthorizedError('Invalid email or password');

  const passwordMatches = await bcrypt.compare(password, row.password_hash);
  if (!passwordMatches) throw new UnauthorizedError('Invalid email or password');

  if (!row.is_active) throw new AppError(403, 'ACCOUNT_INACTIVE', 'This account has been deactivated');

  await query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [row.id]);

  const user = toSelfView(row);
  return { user, token: signToken(user) };
}

async function forgotPassword({ email }) {
  const rows = await query('SELECT id, nickname FROM users WHERE email = ?', [email]);
  const row = rows[0];

  // Always behave the same whether the email exists or not, to avoid
  // leaking which addresses are registered.
  if (row) {
    const token = crypto.randomBytes(32).toString('hex');
    await query(
      'UPDATE users SET reset_token = ?, reset_expires = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE id = ?',
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
    'SELECT id FROM users WHERE reset_token = ? AND reset_expires > NOW()',
    [token]
  );
  const row = rows[0];
  if (!row) throw new AppError(400, 'INVALID_TOKEN', 'This reset link is invalid or has expired');

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  await query(
    'UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?',
    [passwordHash, row.id]
  );

  return { message: 'Password has been reset. You can now log in.' };
}

async function google({ idToken }) {
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    throw new UnauthorizedError('Invalid Google token');
  }
  if (!payload.email_verified) {
    throw new UnauthorizedError('Google account email is not verified');
  }

  const rows = await query(
    'SELECT id, google_id, is_active FROM users WHERE google_id = ? OR email = ?',
    [payload.sub, payload.email]
  );
  let row = rows[0];

  if (!row) {
    const nickname = (payload.name || payload.email.split('@')[0]).slice(0, 50);
    const result = await query(
      'INSERT INTO users (nickname, email, google_id, role) VALUES (?, ?, ?, ?)',
      [nickname, payload.email, payload.sub, 'user']
    );
    row = { id: result.insertId, is_active: 1 };
  } else if (!row.google_id) {
    // Existing password account signing in with Google for the first time — link it.
    await query('UPDATE users SET google_id = ? WHERE id = ?', [payload.sub, row.id]);
  }

  if (!row.is_active) throw new AppError(403, 'ACCOUNT_INACTIVE', 'This account has been deactivated');

  await query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [row.id]);

  const user = await getMe(row.id);
  return { user, token: signToken(user) };
}

module.exports = { register, login, forgotPassword, resetPassword, google };
