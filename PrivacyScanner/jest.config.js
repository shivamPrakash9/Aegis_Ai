module.exports = {
  testEnvironment: 'node',
  verbose: true,
  testMatch: ['**/tests/**/*.test.js'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js'
  ],
  testTimeout: 10000,
  forceExit: true,
  detectOpenHandles: true
};
