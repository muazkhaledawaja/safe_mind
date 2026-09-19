const messagesService = require('./messages.service');
const { ok, created } = require('../../utils/response');

async function listConversations(req, res, next) {
  try {
    ok(res, await messagesService.listForCaller(req.user.id, req.user.role));
  } catch (err) {
    next(err);
  }
}

async function listMessages(req, res, next) {
  try {
    const { items, meta } = await messagesService.listMessages(
      req.user.id,
      req.user.role,
      req.params.id,
      req.query
    );
    ok(res, items, meta);
  } catch (err) {
    next(err);
  }
}

async function sendMessage(req, res, next) {
  try {
    created(
      res,
      await messagesService.sendMessage(req.user.id, req.user.role, req.params.id, req.body.body)
    );
  } catch (err) {
    next(err);
  }
}

async function markRead(req, res, next) {
  try {
    ok(res, await messagesService.markRead(req.user.id, req.user.role, req.params.id));
  } catch (err) {
    next(err);
  }
}

async function unreadCount(req, res, next) {
  try {
    ok(res, { count: await messagesService.unreadCount(req.user.id, req.user.role) });
  } catch (err) {
    next(err);
  }
}

module.exports = { listConversations, listMessages, sendMessage, markRead, unreadCount };
