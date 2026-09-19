const emergencyService = require('./emergency.service');
const resources = require('../../config/resources');
const { ok, created } = require('../../utils/response');

async function listContacts(req, res, next) {
  try {
    ok(res, await emergencyService.listContacts(req.user.id));
  } catch (err) {
    next(err);
  }
}

async function createContact(req, res, next) {
  try {
    created(res, await emergencyService.createContact(req.user.id, req.body));
  } catch (err) {
    next(err);
  }
}

async function updateContact(req, res, next) {
  try {
    ok(res, await emergencyService.updateContact(req.user.id, req.params.id, req.body));
  } catch (err) {
    next(err);
  }
}

async function deleteContact(req, res, next) {
  try {
    await emergencyService.deleteContact(req.user.id, req.params.id);
    ok(res, { deleted: true });
  } catch (err) {
    next(err);
  }
}

// The only trigger for an emergency alert: an authenticated user hitting
// this endpoint. No scheduled job or automated detector may call the
// service function behind this route (CLAUDE.md rule 1).
async function sendAlert(req, res, next) {
  try {
    const result = await emergencyService.sendAlert(req.user.id, req.ip);
    ok(res, result);
  } catch (err) {
    // A failed send (mail provider down) still writes a row and returns 200
    // with status:'failed' from the service — only rate-limit/no-contact
    // conditions reach here as errors.
    next(err);
  }
}

function getResources(req, res) {
  ok(res, resources);
}

module.exports = { listContacts, createContact, updateContact, deleteContact, sendAlert, getResources };
