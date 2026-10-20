// Integration Tests: AI Gateway Client Compatibility Verification

const http = require('http');
const { app } = require('../../src/app');
const { PolicyClient } = require('../../../AIGateway/src/clients/policyClient');
const { policyRepository } = require('../../src/repositories/policy.repository');
const { approvalRepository } = require('../../src/repositories/approval.repository');
const { testOrgId, samplePolicies } = require('../fixtures/syntheticData');

describe('AI Gateway PolicyClient Contract Compatibility', () => {
  let server;
  let client;

  beforeAll((done) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      client = new PolicyClient(`http://127.0.0.1:${port}`);
      done();
    });
  });

  afterAll((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  beforeEach(() => {
    policyRepository.setForceInMemory(true);
    approvalRepository.setForceInMemory(true);
    policyRepository.clear();
    approvalRepository.clear();
  });

  test('PolicyClient evaluates ALLOW response seamlessly', async () => {
    const result = await client.evaluate({
      organizationId: testOrgId,
      principal: { id: 'usr_client_test', role: 'MEMBER' },
      messages: [{ role: 'user', content: 'What is the capital of France?' }],
      modelPreference: { model: 'gpt-4o-mini', provider: 'openai' },
      correlationId: 'test-gateway-corr-1'
    });

    expect(result).toBeDefined();
    expect(result.decision).toBe('ALLOW');
    expect(Array.isArray(result.violations)).toBe(true);
  });

  test('PolicyClient evaluates DENY response with violations structure', async () => {
    await policyRepository.createPolicy({
      organizationId: testOrgId,
      name: samplePolicies.modelGovernance.name,
      rules: samplePolicies.modelGovernance.rules,
      createdBy: 'admin_test'
    });

    const result = await client.evaluate({
      organizationId: testOrgId,
      principal: { id: 'usr_client_test', role: 'MEMBER' },
      messages: [{ role: 'user', content: 'Test prompt' }],
      modelPreference: { model: 'untrusted-free-model', provider: 'untrusted' },
      correlationId: 'test-gateway-corr-2'
    });

    expect(result).toBeDefined();
    expect(result.decision).toBe('DENY');
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0].rule).toBe('rule-deny-unauthorized-models');
    expect(result.violations[0].reason).toBeDefined();
  });

  test('PolicyClient evaluates REQUIRE_APPROVAL response with approvalId', async () => {
    await policyRepository.createPolicy({
      organizationId: testOrgId,
      name: samplePolicies.modelGovernance.name,
      rules: samplePolicies.modelGovernance.rules,
      createdBy: 'admin_test'
    });

    const result = await client.evaluate({
      organizationId: testOrgId,
      principal: { id: 'usr_client_test', role: 'DEVELOPER' },
      messages: [{ role: 'user', content: 'High compute query' }],
      modelPreference: { model: 'gpt-4o', provider: 'openai' },
      correlationId: 'test-gateway-corr-3'
    });

    expect(result).toBeDefined();
    expect(result.decision).toBe('REQUIRE_APPROVAL');
    expect(result.approvalId).toBeDefined();
    expect(result.requiredApprovers).toContain('SECURITY_ADMIN');
  });
});
