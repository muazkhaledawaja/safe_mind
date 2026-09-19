const specialistsService = require('./specialists.service');
const { ok, created } = require('../../utils/response');

async function apply(req, res, next) {
  try {
    created(res, await specialistsService.apply(req.user.id, req.body));
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    const { items, meta } = await specialistsService.listApproved(req.query);
    ok(res, items, meta);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    ok(res, specialistsService.toView(await specialistsService.findApprovedById(req.params.id)));
  } catch (err) {
    next(err);
  }
}

module.exports = { apply, list, getById };
