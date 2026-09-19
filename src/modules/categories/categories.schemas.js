const { z } = require('zod');

const createCategory = z.object({
  nameAr: z.string().trim().min(1).max(100),
  nameEn: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).optional(),
  sortOrder: z.coerce.number().int().optional().default(0),
});

const updateCategory = z.object({
  nameAr: z.string().trim().min(1).max(100).optional(),
  nameEn: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(2000).optional(),
  sortOrder: z.coerce.number().int().optional(),
});

const categoryIdParam = z.object({
  id: z.coerce.number().int().positive(),
});

module.exports = { createCategory, updateCategory, categoryIdParam };
