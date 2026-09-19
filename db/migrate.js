// Plain SQL migration runner. Applies db/migrations/*.sql in filename order,
// tracks what ran in schema_migrations, and skips anything already applied.
// `node db/migrate.js` runs migrations. `node db/migrate.js --seed` also runs
// db/seeds/*.sql (idempotency of seeds is each seed file's own job).
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const SEEDS_DIR = path.join(__dirname, 'seeds');

async function run() {
  const dbName = process.env.NODE_ENV === 'test' ? process.env.DB_NAME_TEST : process.env.DB_NAME;

  // Connect without a database first so we can create it if missing.
  const admin = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });
  await admin.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await admin.end();

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: dbName,
    multipleStatements: true,
  });

  await conn.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  const [appliedRows] = await conn.query('SELECT name FROM schema_migrations');
  const applied = new Set(appliedRows.map((r) => r.name));

  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip  ${file} (already applied)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    console.log(`apply ${file}`);
    await conn.query(sql);
    await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
  }

  if (process.argv.includes('--seed')) {
    const seedFiles = fs.readdirSync(SEEDS_DIR).filter((f) => f.endsWith('.sql')).sort();
    for (const file of seedFiles) {
      console.log(`seed  ${file}`);
      const sql = fs.readFileSync(path.join(SEEDS_DIR, file), 'utf-8');
      await conn.query(sql);
    }
  }

  await conn.end();
  console.log('done');
}

if (require.main === module) {
  run().catch((err) => {
    console.error('migration failed:', err.message);
    process.exit(1);
  });
}

module.exports = run;
