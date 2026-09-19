// Validates process.env at boot. Fails fast with a clear list of what's missing
// instead of surfacing a confusing error deep in some unrelated module later.
require('dotenv').config();
const { z } = require('zod');

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
  DB_NAME_TEST: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().min(1).default('7d'),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),
  MAIL_FROM: z.string().min(1),
  APP_URL: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const missing = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
  console.error(`Invalid environment configuration:\n  ${missing}`);
  process.exit(1);
}

const env = parsed.data;
// In tests, run against the test database instead of the dev one.
if (env.NODE_ENV === 'test' && env.DB_NAME_TEST) {
  env.DB_NAME = env.DB_NAME_TEST;
}

module.exports = env;
