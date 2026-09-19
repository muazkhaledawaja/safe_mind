const { z } = require('zod');
const { paginationQuery } = require('../../utils/pagination');

const apply = z.object({
  specialization: z.string().trim().min(1).max(100),
  bio: z.string().trim().max(2000).optional(),
  licenseNumber: z.string().trim().max(100).optional(),
  yearsExperience: z.coerce.number().int().min(0).max(80).optional(),
});

const listQuery = paginationQuery.extend({
  specialization: z.string().trim().min(1).optional(),
});

const specialistIdParam = z.object({
  id: z.coerce.number().int().positive(),
});

module.exports = { apply, listQuery, specialistIdParam };
