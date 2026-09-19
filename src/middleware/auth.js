const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { query } = require('../config/db');
const { UnauthorizedError } = require('../utils/errors');

// Verifies the bearer JWT and attaches { id, role } to req.user.
// Also checks the account is still active — a deactivated user's old
// token should stop working immediately, not just at expiry.
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedError('Missing or malformed Authorization header');
    }

    let payload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }

    const rows = await query('SELECT id, role, is_active FROM users WHERE id = ?', [payload.sub]);
    const user = rows[0];
    if (!user) throw new UnauthorizedError('Invalid or expired token');
    if (!user.is_active) throw new UnauthorizedError('Account is deactivated');

    req.user = { id: user.id, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = requireAuth;
