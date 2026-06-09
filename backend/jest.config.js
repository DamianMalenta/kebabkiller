export default {
  testEnvironment: 'node',
  transform: {},
  setupFilesAfterEnv: ['./setupTests.js'],
  testMatch: ['**/src/tests/**/*.test.js'],
  testTimeout: 30000,
};
