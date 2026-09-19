const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { query } = require('../config/db');
const { UnauthorizedError } = require('../utils/errors');

// Verifies a JWT and confirms the account still exists and is active — a
// deactivated user's old token should stop working immediately, not just at
// expiry. Shared by the HTTP middleware below and the socket handshake
// (src/sockets/auth.js) so both paths enforce the same rules.
async function verifyUser(token) {
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

  return { id: user.id, role: user.role };
}

// Verifies the bearer JWT and attaches { id, role } to req.user.
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedError('Missing or malformed Authorization header');
    }

    req.user = await verifyUser(token);
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = requireAuth;
module.exports.verifyUser = verifyUser;
