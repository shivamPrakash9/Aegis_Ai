// Synthetic Test Data and Token Generators for ModelProvider Tests

const jwt = require('jsonwebtoken');
const { env } = require('../../src/config/env');

const testOrgId = 'org_enterprise_alpha';
const testOrgIdBeta = 'org_enterprise_beta';

function generateTestToken({
  sub = 'user_admin_123',
  organizationId = testOrgId,
  role = 'ORGANIZATION_ADMIN',
  permissions = ['model:invoke', 'model:admin']
} = {}) {
  return jwt.sign(
    {
      sub,
      organizationId,
      role,
      permissions
    },
    env.modelJwtSecret,
    {
      issuer: env.modelJwtIssuer,
      audience: env.modelJwtAudience,
      expiresIn: '1h'
    }
  );
}

const sampleRequests = {
  gatewayFormat: {
    organizationId: testOrgId,
    messages: [
      { role: 'system', content: 'You are a helpful governance assistant.' },
      { role: 'user', content: 'Explain zero-trust architecture in 3 sentences.' }
    ],
    modelPreference: {
      provider: 'mock',
      model: 'mock-gpt-4o'
    },
    routingConstraints: {
      allowedProviders: ['mock']
    },
    traceId: 'trace_test_123',
    requestId: 'req_test_123'
  },

  openaiStandardFormat: {
    organizationId: testOrgId,
    model: 'mock-gpt-4o',
    messages: [
      { role: 'user', content: 'What is the speed of light?' }
    ],
    temperature: 0.7,
    max_tokens: 500
  }
};

module.exports = {
  testOrgId,
  testOrgIdBeta,
  generateTestToken,
  sampleRequests
};
