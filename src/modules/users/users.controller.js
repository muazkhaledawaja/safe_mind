const usersService = require('./users.service');
const { ok } = require('../../utils/response');

async function getMe(req, res, next) {
  try {
    ok(res, await usersService.getMe(req.user.id));
  } catch (err) {
    next(err);
  }
}

async function updateMe(req, res, next) {
  try {
    ok(res, await usersService.updateMe(req.user.id, req.body));
  } catch (err) {
    next(err);
  }
}

module.exports = { getMe, updateMe };
