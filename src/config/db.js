const { Pool, types } = require('pg');
const env = require('./env');

// Postgres returns INT8 (BIGINT, used by id columns and COUNT(*)) and NUMERIC
// (DECIMAL/AVG) as strings. Parse them back to numbers so services and tests
// get the same shapes they got from MySQL.
types.setTypeParser(20, (v) => parseInt(v, 10));
types.setTypeParser(1700, (v) => parseFloat(v));

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
});

// Converts MySQL-style `?` parameter markers to Postgres `$1..$n` so all the
// SQL in services stays readable and portable. Scans outside single-quoted
// literals only, so a `?` inside a string is never treated as a marker.
function toPostgres(sql, params) {
  let out = '';
  let index = 0;
  let inString = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (inString) {
      out += ch;
      if (ch === "'") {
        if (sql[i + 1] === "'") {
          out += sql[i + 1];
          i += 1;
        } else {
          inString = false;
        }
      }
      continue;
    }
    if (ch === "'") {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === '?') {
      index += 1;
      out += `$${index}`;
      continue;
    }
    out += ch;
  }
  if (index !== params.length) {
    throw new Error(
      `Placeholder count (${index}) does not match parameter count (${params.length}) in: ${sql}`
    );
  }
  return out;
}

// Thin wrapper so services never touch pool internals directly. Returns the
// rows array, the same shape the mysql2 wrapper returned.
async function query(sql, params = []) {
  const { rows } = await pool.query(toPostgres(sql, params), params);
  return rows;
}

// Transaction boundary. The returned client's query() returns rows arrays
// exactly like query(); BEGIN/COMMIT/ROLLBACK/RELEASE map to the pg client.
async function getConnection() {
  const client = await pool.connect();
  return {
    query: async (sql, params = []) => {
      const { rows } = await client.query(toPostgres(sql, params), params);
      return rows;
    },
    beginTransaction: () => client.query('BEGIN'),
    commit: () => client.query('COMMIT'),
    rollback: () => client.query('ROLLBACK'),
    release: () => client.release(),
  };
}

module.exports = { pool, query, getConnection, toPostgres };