// Plain SQL migration runner for Postgres/Supabase. Applies
// db/migrations/*.sql in filename order, tracks what ran in
// schema_migrations, and skips anything already applied.
// `node db/migrate.js` runs migrations. `node db/migrate.js --seed` also runs
// db/seeds/*.sql (idempotency of seeds is each seed file's own job).
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

    if (process.argv.includes('--seed')) {
      const seedFiles = fs.readdirSync(SEEDS_DIR).filter((f) => f.endsWith('.sql')).sort();
      for (const file of seedFiles) {
        console.log(`seed  ${file}`);
        const sql = fs.readFileSync(path.join(SEEDS_DIR, file), 'utf-8');
        await client.query(sql);
      }
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