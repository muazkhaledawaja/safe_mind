const { z } = require('zod');

const createContact = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().min(1).max(20).optional(),
  relationship: z.string().trim().min(1).max(50).optional(),
  isPrimary: z.boolean().optional().default(false),
});

const updateContact = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  phone: z.string().trim().min(1).max(20).optional(),
  relationship: z.string().trim().min(1).max(50).optional(),
  isPrimary: z.boolean().optional(),
});

const contactIdParam = z.object({
  id: z.coerce.number().int().positive(),
});

module.exports = { createContact, updateContact, contactIdParam };
