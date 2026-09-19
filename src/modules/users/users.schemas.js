const { z } = require('zod');

const updateMe = z
  .object({
    nickname: z.string().trim().min(2).max(50).optional(),
    fullName: z.string().trim().min(1).max(100).optional(),
    password: z.string().min(8).max(72).optional(),
    currentPassword: z.string().min(1).optional(),
  })
  .refine((data) => !data.password || data.currentPassword, {
    message: 'currentPassword is required to change password',
    path: ['currentPassword'],
  });

module.exports = { updateMe };
