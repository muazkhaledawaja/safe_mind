// Plain SQL migration runner for Postgres/Supabase. Applies
// db/migrations/*.sql in filename order, tracks what ran in
// schema_migrations, and skips anything already applied.
// `node db/migrate.js` runs migrations and then applies db/seeds/*.sql (all
// seed files are idempotent — categories.sql is ON CONFLICT DO NOTHING).
// `--seed` is accepted for backwards compatibility.
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const env = require('../src/config/env');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const SEEDS_DIR = path.join(__dirname, 'seeds');

async function run() {
  const client = new Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.name));

    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip  ${file} (already applied)`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      console.log(`apply ${file}`);
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    }

    // Always run SQL seeds (idempotent by design). This is the only way a
    // fresh production DB gets its category rows — a DB created from
    // schema.sql alone has no categories, and article creation failed with a
    // raw FK violation because of it.
    const seedFiles = fs.readdirSync(SEEDS_DIR).filter((f) => f.endsWith('.sql')).sort();
    for (const file of seedFiles) {
      console.log(`seed  ${file}`);
      const sql = fs.readFileSync(path.join(SEEDS_DIR, file), 'utf-8');
      await client.query(sql);
    }
  } finally {
    await client.end();
  }
  console.log('done');
}

if (require.main === module) {
  run().catch((err) => {
    console.error('migration failed:', err.message);
    process.exit(1);
  });
}

module.exports = run;