const appointmentsService = require('./appointments.service');
const { ok, created } = require('../../utils/response');

async function create(req, res, next) {
  try {
    created(res, await appointmentsService.create(req.user.id, req.body));
  } catch (err) {
    next(err);
  }
}

async function respond(req, res, next) {
  try {
    ok(res, await appointmentsService.respond(req.user.id, req.params.id, req.body));
  } catch (err) {
    next(err);
  }
}

async function cancel(req, res, next) {
  try {
    ok(res, await appointmentsService.cancel(req.user.id, req.params.id));
  } catch (err) {
    next(err);
  }
}

// A single list endpoint that returns whichever side of the relationship
// the caller is on: their own bookings as a user, plus (if they're an
// approved specialist) the bookings made with them.
async function list(req, res, next) {
  try {
    const asUser = await appointmentsService.listForUser(req.user.id, req.query);
    if (req.user.role !== 'specialist') {
      return ok(res, asUser.items, asUser.meta);
    }
    const asSpecialist = await appointmentsService.listForSpecialist(req.user.id, req.query);
    ok(res, asSpecialist.items, asSpecialist.meta);
  } catch (err) {
    next(err);
  }
}

module.exports = { create, respond, cancel, list };
