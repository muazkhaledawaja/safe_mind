const { z } = require('zod');

// Every list endpoint takes ?page=&limit= (default 10, max 50) per CLAUDE.md §5.
const paginationQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

function toMeta(page, limit, total) {
  return { page, limit, total };
}

module.exports = { paginationQuery, toMeta };
