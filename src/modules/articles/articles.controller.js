const articlesService = require('./articles.service');
const { ok, created } = require('../../utils/response');

async function listPublished(req, res, next) {
  try {
    const { items, meta } = await articlesService.listPublished(req.query);
    ok(res, items, meta);
  } catch (err) {
    next(err);
  }
}

async function listAll(req, res, next) {
  try {
    const { items, meta } = await articlesService.listAll(req.query);
    ok(res, items, meta);
  } catch (err) {
    next(err);
  }
}

async function getBySlug(req, res, next) {
  try {
    ok(res, await articlesService.findPublishedBySlug(req.params.slug));
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    created(res, await articlesService.create(req.user.id, req.body));
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    ok(res, await articlesService.update(req.params.id, req.body));
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    await articlesService.remove(req.params.id);
    ok(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listPublished, listAll, getBySlug, create, update, remove };
