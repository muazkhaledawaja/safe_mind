module.exports = {
  testEnvironment: 'node',
  globalSetup: './tests/globalSetup.js',
  setupFilesAfterEnv: ['./tests/setup.js'],
  testTimeout: 60000,
  testMatch: ['<rootDir>/tests/**/*.test.js'],
};
