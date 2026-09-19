const { admin } = require('../config/supabase');
const { query } = require('../config/db');
const { UnauthorizedError } = require('../utils/errors');

// Verifies a Supabase Auth access token (getUser() rejects expired, malformed
// or revoked tokens; it also live-checks the token against the Auth server)
// and confirms the linked Safe Mind account still exists and is active — a
// deactivated user's old token stops working immediately, not just at expiry.
// Shared by the HTTP middleware below and by ownership helpers elsewhere.
async function verifyUser(token) {
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new UnauthorizedError('Invalid or expired token');

  const rows = await query('SELECT id, role, is_active FROM users WHERE auth_uid = ?', [data.user.id]);
  const user = rows[0];
  if (!user) throw new UnauthorizedError('Invalid or expired token');
  if (!user.is_active) throw new UnauthorizedError('Account is deactivated');

  return { id: user.id, role: user.role };
}

// Verifies the bearer token and attaches { id, role } to req.user.
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