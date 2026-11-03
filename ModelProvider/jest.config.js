module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  verbose: true,
  testTimeout: 20000,
  clearMocks: true,
  restoreMocks: true,
  forceExit: true,
  detectOpenHandles: true,
  coveragePathIgnorePatterns: ['/node_modules/', '/tests/fixtures/']
};
