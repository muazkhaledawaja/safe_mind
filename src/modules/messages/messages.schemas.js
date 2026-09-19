const { z } = require('zod');
const { paginationQuery } = require('../../utils/pagination');

const sendMessage = z.object({
  body: z.string().trim().min(1).max(5000),
});

const conversationIdParam = z.object({
  id: z.coerce.number().int().positive(),
});

const messageIdParam = z.object({
  id: z.coerce.number().int().positive(),
});

module.exports = { sendMessage, conversationIdParam, messageIdParam, listQuery: paginationQuery };
