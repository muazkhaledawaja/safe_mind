// Runs once before the whole test suite. Ensures the test database exists
// and every migration is applied, so individual test files don't race each
// other trying to migrate.
process.env.NODE_ENV = 'test';
require('dotenv').config();

module.exports = async () => {
  process.env.NODE_ENV = 'test';
  const migrate = require('../db/migrate.js');
  await migrate();
};
