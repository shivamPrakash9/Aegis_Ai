module.exports = {
  testEnvironment: 'node',
  verbose: true,
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 10000,
  clearMocks: true,
  restoreMocks: true,
  coveragePathIgnorePatterns: ['/node_modules/']
};
