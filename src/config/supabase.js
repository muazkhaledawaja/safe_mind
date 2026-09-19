const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

// Admin client (service role key) — server-side only. Used for user
// provisioning and password/reset management, and to introspect access
// tokens in the auth middleware.
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Anon client — exchanges email/password or Google ID tokens for end-user
// sessions. Contains no secrets.
const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

module.exports = { admin, anon };