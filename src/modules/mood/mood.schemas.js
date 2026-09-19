const { z } = require('zod');

const level = z.coerce.number().int().min(1).max(5);
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

const createMood = z.object({
  moodLevel: level,
  stressLevel: level,
  sleepQuality: level,
  sleepHours: z.coerce.number().min(0).max(24).optional(),
  note: z.string().trim().max(2000).optional(),
});

const updateMood = z.object({
  moodLevel: level.optional(),
  stressLevel: level.optional(),
  sleepQuality: level.optional(),
  sleepHours: z.coerce.number().min(0).max(24).optional(),
  note: z.string().trim().max(2000).optional(),
});

const dateParam = z.object({
  date: dateString,
});

const rangeQuery = z.object({
  from: dateString.optional(),
  to: dateString.optional(),
});

const summaryQuery = z.object({
  range: z.enum(['7d', '30d', '90d']).optional().default('30d'),
  groupBy: z.enum(['day', 'week']).optional().default('day'),
});

module.exports = { createMood, updateMood, dateParam, rangeQuery, summaryQuery };
