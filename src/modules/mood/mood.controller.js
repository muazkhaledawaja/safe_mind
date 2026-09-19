const moodService = require('./mood.service');
const { ok, created } = require('../../utils/response');

async function create(req, res, next) {
  try {
    created(res, await moodService.create(req.user.id, req.body));
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    ok(res, await moodService.update(req.user.id, req.params.date, req.body));
  } catch (err) {
    next(err);
  }
}

async function listRange(req, res, next) {
  try {
    ok(res, await moodService.listRange(req.user.id, req.query));
  } catch (err) {
    next(err);
  }
}

async function summary(req, res, next) {
  try {
    ok(res, await moodService.summary(req.user.id, req.query));
  } catch (err) {
    next(err);
  }
}

module.exports = { create, update, listRange, summary };
