// Integration Tests: Policy Evaluation Flow (POST /v1/evaluate)

const request = require('supertest');
const { app } = require('../../src/app');
const { policyRepository } = require('../../src/repositories/policy.repository');
const { approvalRepository } = require('../../src/repositories/approval.repository');
const { testOrgId, testOrgIdBeta, samplePolicies } = require('../fixtures/syntheticData');

describe('Policy Evaluation Flow (POST /v1/evaluate)', () => {
  beforeEach(() => {
    policyRepository.setForceInMemory(true);
    approvalRepository.setForceInMemory(true);
    policyRepository.clear();
    approvalRepository.clear();
  });

  test('returns ALLOW when organization has no active policies', async () => {
    const payload = {
      organizationId: testOrgId,
      principal: { id: 'usr_123', role: 'MEMBER' },
      messages: [{ role: 'user', content: 'What is quantum computing?' }],
      modelPreference: { model: 'gpt-4o-mini', provider: 'openai' }
    };

    const res = await request(app)
      .post('/v1/evaluate')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('ALLOW');
    expect(res.body.violations).toEqual([]);
    expect(res.body.evaluationId).toBeDefined();
  });

  test('returns ALLOW when request satisfies allowed model rules', async () => {
    await policyRepository.createPolicy({
      organizationId: testOrgId,
      name: samplePolicies.modelGovernance.name,
      description: samplePolicies.modelGovernance.description,
      rules: samplePolicies.modelGovernance.rules,
      createdBy: 'admin_1'
    });

    const payload = {
      organizationId: testOrgId,
      principal: { id: 'usr_123', role: 'MEMBER' },
      messages: [{ role: 'user', content: 'Explain recursion.' }],
      modelPreference: { model: 'gpt-4o-mini', provider: 'openai' }
    };

    const res = await request(app)
      .post('/v1/evaluate')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('ALLOW');
  });

  test('returns DENY when untrusted model or excessive length triggers DENY rule', async () => {
    await policyRepository.createPolicy({
      organizationId: testOrgId,
      name: samplePolicies.modelGovernance.name,
      rules: samplePolicies.modelGovernance.rules,
      createdBy: 'admin_1'
    });

    const payload = {
      organizationId: testOrgId,
      principal: { id: 'usr_123', role: 'MEMBER' },
      messages: [{ role: 'user', content: 'Hello' }],
      modelPreference: { model: 'untrusted-free-model', provider: 'unknown' }
    };

    const res = await request(app)
      .post('/v1/evaluate')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('DENY');
    expect(res.body.reasonCode).toBe('POLICY_MODEL_NOT_APPROVED');
    expect(res.body.violations).toHaveLength(1);
    expect(res.body.violations[0].rule).toBe('rule-deny-unauthorized-models');
  });

  test('returns REQUIRE_APPROVAL and generates persistent approval request for frontier models', async () => {
    await policyRepository.createPolicy({
      organizationId: testOrgId,
      name: samplePolicies.modelGovernance.name,
      rules: samplePolicies.modelGovernance.rules,
      createdBy: 'admin_1'
    });

    const payload = {
      organizationId: testOrgId,
      principal: { id: 'usr_developer', role: 'DEVELOPER' },
      messages: [{ role: 'user', content: 'Generate high-level architecture diagram' }],
      modelPreference: { model: 'gpt-4o', provider: 'openai' },
      requestId: 'req_client_999'
    };

    const res = await request(app)
      .post('/v1/evaluate')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('REQUIRE_APPROVAL');
    expect(res.body.reasonCode).toBe('APPROVAL_REQUIRED_FRONTIER_MODEL');
    expect(res.body.requiredApprovers).toContain('SECURITY_ADMIN');
    expect(res.body.requiredApprovers).toContain('MANAGER');
    expect(res.body.approvalId).toBeDefined();

    // Verify approval request was recorded in repository
    const stored = await approvalRepository.findById(res.body.approvalId, testOrgId);
    expect(stored).toBeDefined();
    expect(stored.status).toBe('PENDING');
    expect(stored.requesterId).toBe('usr_developer');
  });

  test('strictly enforces tenant isolation during evaluation', async () => {
    // Org Alpha has restrictive policy
    await policyRepository.createPolicy({
      organizationId: testOrgId,
      name: 'Alpha Restrictive',
      rules: [
        {
          id: 'rule-deny-all',
          name: 'Block everything in alpha',
          effect: 'DENY',
          priority: 1,
          condition: {},
          reason: 'Alpha lockout'
        }
      ],
      createdBy: 'admin_alpha'
    });

    // Request from Org Beta should NOT be affected by Org Alpha's policy
    const payloadBeta = {
      organizationId: testOrgIdBeta,
      principal: { id: 'usr_beta', role: 'MEMBER' },
      messages: [{ role: 'user', content: 'Hello Beta' }],
      modelPreference: { model: 'gpt-4o-mini', provider: 'openai' }
    };

    const resBeta = await request(app)
      .post('/v1/evaluate')
      .send(payloadBeta);

    expect(resBeta.status).toBe(200);
    expect(resBeta.body.decision).toBe('ALLOW');
  });

  test('validates required payload properties and fails closed with 400 Bad Request', async () => {
    const res = await request(app)
      .post('/v1/evaluate')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});
