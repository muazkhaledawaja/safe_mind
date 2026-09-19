const { z } = require('zod');
const { paginationQuery } = require('../../utils/pagination');

const createArticle = z.object({
  categoryId: z.coerce.number().int().positive(),
  title: z.string().trim().min(1).max(255),
  excerpt: z.string().trim().max(500).optional(),
  content: z.string().trim().min(1),
  coverImage: z.string().trim().max(255).optional(),
  status: z.enum(['draft', 'published']).optional().default('draft'),
});

const updateArticle = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
  title: z.string().trim().min(1).max(255).optional(),
  excerpt: z.string().trim().max(500).optional(),
  content: z.string().trim().min(1).optional(),
  coverImage: z.string().trim().max(255).optional(),
  status: z.enum(['draft', 'published']).optional(),
});

const articleIdParam = z.object({
  id: z.coerce.number().int().positive(),
});

const articleSlugParam = z.object({
  slug: z.string().min(1),
});

const listQuery = paginationQuery.extend({
  search: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(), // category slug
});

module.exports = { createArticle, updateArticle, articleIdParam, articleSlugParam, listQuery };
