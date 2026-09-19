// Validates process.env at boot. Fails fast with a clear list of what's
// missing instead of surfacing a confusing error deep in some unrelated
// module later.
require('dotenv').config();
const { z } = require('zod');

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  // Optional dedicated URL for the test suite; falls back to DATABASE_URL.
  DATABASE_URL_TEST: z.string().min(1).optional(),
  SUPABASE_URL: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),
  MAIL_FROM: z.string().min(1),
  APP_URL: z.string().min(1),
  // Required only to recover/link an existing password account during Google
  // sign-in. Normal Google login works without it (Supabase verifies the id_token).
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const missing = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
  console.error(`Invalid environment configuration:\n  ${missing}`);
  process.exit(1);
}

const env = parsed.data;
// In tests, run against the test database instead of the dev one.
if (env.NODE_ENV === 'test' && env.DATABASE_URL_TEST) {
  env.DATABASE_URL = env.DATABASE_URL_TEST;
}

module.exports = env;