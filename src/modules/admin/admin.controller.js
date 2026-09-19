const adminService = require('./admin.service');
const { ok } = require('../../utils/response');

async function listUsers(req, res, next) {
  try {
    const { items, meta } = await adminService.listUsers(req.query);
    ok(res, items, meta);
  } catch (err) {
    next(err);
  }
}

async function setUserStatus(req, res, next) {
  try {
    const updated = await adminService.setUserStatus(req.user.id, req.params.id, req.body.isActive, req.ip);
    ok(res, updated);
  } catch (err) {
    next(err);
  }
}

async function listSpecialists(req, res, next) {
  try {
    const { items, meta } = await adminService.listSpecialists(req.query);
    ok(res, items, meta);
  } catch (err) {
    next(err);
  }
}

async function verifySpecialist(req, res, next) {
  try {
    const updated = await adminService.verifySpecialist(req.user.id, req.params.id, req.body, req.ip);
    ok(res, updated);
  } catch (err) {
    next(err);
  }
}

async function getStats(req, res, next) {
  try {
    ok(res, await adminService.getStats());
  } catch (err) {
    next(err);
  }
}

async function listAuditLogs(req, res, next) {
  try {
    const { items, meta } = await adminService.listAuditLogs(req.query);
    ok(res, items, meta);
  } catch (err) {
    next(err);
  }
}

module.exports = { listUsers, setUserStatus, listSpecialists, verifySpecialist, getStats, listAuditLogs };
