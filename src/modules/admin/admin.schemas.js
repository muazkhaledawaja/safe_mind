const { z } = require('zod');
const { paginationQuery } = require('../../utils/pagination');

const listUsersQuery = paginationQuery.extend({
  role: z.enum(['user', 'specialist', 'admin']).optional(),
});

const updateUserStatus = z.object({
  isActive: z.boolean(),
});

const userIdParam = z.object({
  id: z.coerce.number().int().positive(),
});

const listSpecialistsQuery = paginationQuery.extend({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

const verifySpecialist = z
  .object({
    decision: z.enum(['approved', 'rejected']),
    rejectionReason: z.string().trim().max(255).optional(),
  })
  .refine((data) => data.decision !== 'rejected' || data.rejectionReason, {
    message: 'rejectionReason is required when rejecting',
    path: ['rejectionReason'],
  });

const specialistIdParam = z.object({
  id: z.coerce.number().int().positive(),
});

const auditLogsQuery = paginationQuery.extend({
  actorId: z.coerce.number().int().positive().optional(),
  action: z.string().trim().min(1).optional(),
});

module.exports = {
  listUsersQuery,
  updateUserStatus,
  userIdParam,
  listSpecialistsQuery,
  verifySpecialist,
  specialistIdParam,
  auditLogsQuery,
};
