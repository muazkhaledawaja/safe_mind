const { z } = require('zod');

const register = z.object({
  nickname: z.string().trim().min(2).max(50),
  fullName: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
});

const login = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const forgotPassword = z.object({
  email: z.string().trim().toLowerCase().email(),
});

const resetPassword = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(72),
});

const google = z.object({
  idToken: z.string().min(1),
});

module.exports = { register, login, forgotPassword, resetPassword, google };
