const { z } = require('zod');
const { paginationQuery } = require('../../utils/pagination');

const createAppointment = z.object({
  specialistId: z.coerce.number().int().positive(),
  scheduledAt: z.coerce.date(),
  durationMin: z.coerce.number().int().positive().max(240).optional().default(45),
  userNote: z.string().trim().max(2000).optional(),
});

const respondAppointment = z.object({
  decision: z.enum(['accepted', 'rejected']),
  responseNote: z.string().trim().max(2000).optional(),
});

const appointmentIdParam = z.object({
  id: z.coerce.number().int().positive(),
});

const listQuery = paginationQuery.extend({
  status: z.enum(['pending', 'accepted', 'rejected', 'cancelled', 'completed']).optional(),
});

module.exports = { createAppointment, respondAppointment, appointmentIdParam, listQuery };
