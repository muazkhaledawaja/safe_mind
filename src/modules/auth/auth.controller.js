const authService = require('./auth.service');
const usersService = require('../users/users.service');
const { ok, created } = require('../../utils/response');

async function register(req, res, next) {
  try {
    created(res, await authService.register(req.body));
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    ok(res, await authService.login(req.body));
  } catch (err) {
    next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    ok(res, await authService.forgotPassword(req.body));
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    ok(res, await authService.resetPassword(req.body));
  } catch (err) {
    next(err);
  }
}

async function google(req, res, next) {
  try {
    ok(res, await authService.google(req.body));
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    ok(res, await usersService.getMe(req.user.id));
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, forgotPassword, resetPassword, google, me };
