const rateLimit = require('express-rate-limit');

// Protects login/forgot-password from brute force and enumeration spam.
// Skipped in tests: supertest hits every route from the same IP in a tight
// loop across many independent test cases, which isn't the brute-force
// pattern this limiter exists to catch.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many attempts, try again later' } },
});

module.exports = { authLimiter };
