const path = require('path');

module.exports = {
  testEnvironment: 'node',
  verbose: true,
  testTimeout: 30000,
  clearMocks: true,
  restoreMocks: true,
  testMatch: ['**/*.e2e.test.js', '**/*.test.js'],
  moduleDirectories: [
    'node_modules',
    path.resolve(__dirname, '../../AIGateway/node_modules')
  ]
};
