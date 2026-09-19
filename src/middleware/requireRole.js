const { ForbiddenError } = require('../utils/errors');

// Use after requireAuth. requireRole('admin') / requireRole('admin', 'specialist')
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ForbiddenError('This action requires a different role'));
    }
    next();
  };
}

module.exports = requireRole;
