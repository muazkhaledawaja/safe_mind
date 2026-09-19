const categoriesService = require('./categories.service');
const { ok, created } = require('../../utils/response');

async function list(req, res, next) {
  try {
    ok(res, await categoriesService.list());
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    created(res, await categoriesService.create(req.body));
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    ok(res, await categoriesService.update(req.params.id, req.body));
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await categoriesService.remove(req.params.id);
    ok(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
