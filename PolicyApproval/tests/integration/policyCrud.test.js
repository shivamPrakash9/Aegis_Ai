// Integration Tests: Policy Administration and CRUD Operations

const request = require('supertest');
const { app } = require('../../src/app');
const { policyRepository } = require('../../src/repositories/policy.repository');
const { testOrgId, testOrgIdBeta, generateTestToken, samplePolicies } = require('../fixtures/syntheticData');

describe('Policy Administration API', () => {
  const adminToken = generateTestToken({ organizationId: testOrgId, role: 'POLICY_ADMIN' });
  const memberToken = generateTestToken({ organizationId: testOrgId, role: 'MEMBER' });
  const betaAdminToken = generateTestToken({ organizationId: testOrgIdBeta, role: 'POLICY_ADMIN' });

  beforeEach(() => {
    policyRepository.setForceInMemory(true);
    policyRepository.clear();
  });

  test('POST /v1/policies creates policy when caller is authorized admin', async () => {
    const payload = {
      organizationId: testOrgId,
      name: 'Custom Safety Policy',
      description: 'Test policy description',
      rules: samplePolicies.modelGovernance.rules
    };

    const res = await request(app)
      .post('/v1/policies')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Custom Safety Policy');
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.rules).toHaveLength(4);
  });

  test('POST /v1/policies returns 403 when caller has insufficient role', async () => {
    const payload = {
      organizationId: testOrgId,
      name: 'Unauthorized Policy',
      rules: samplePolicies.modelGovernance.rules
    };

    const res = await request(app)
      .post('/v1/policies')
      .set('Authorization', `Bearer ${memberToken}`)
      .send(payload);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('GET /v1/policies lists policies scoped to current tenant', async () => {
    // Seed 2 policies in Org Alpha and 1 policy in Org Beta
    await policyRepository.createPolicy({
      organizationId: testOrgId,
      name: 'Policy Alpha 1',
      rules: samplePolicies.modelGovernance.rules,
      createdBy: 'admin_1'
    });
    await policyRepository.createPolicy({
      organizationId: testOrgId,
      name: 'Policy Alpha 2',
      rules: samplePolicies.roleBasedAccess.rules,
      createdBy: 'admin_1'
    });
    await policyRepository.createPolicy({
      organizationId: testOrgIdBeta,
      name: 'Policy Beta 1',
      rules: samplePolicies.modelGovernance.rules,
      createdBy: 'admin_beta'
    });

    const res = await request(app)
      .get('/v1/policies')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items.every((p) => p.organizationId === testOrgId)).toBe(true);
  });

  test('GET /v1/policies/:id retrieves specific policy and rejects cross-tenant lookup', async () => {
    const created = await policyRepository.createPolicy({
      organizationId: testOrgId,
      name: 'Org Alpha Exclusive Policy',
      rules: samplePolicies.modelGovernance.rules,
      createdBy: 'admin_1'
    });

    // Valid lookup
    const validRes = await request(app)
      .get(`/v1/policies/${created.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(validRes.status).toBe(200);
    expect(validRes.body.id).toBe(created.id);

    // Cross-tenant lookup from Org Beta admin
    const crossRes = await request(app)
      .get(`/v1/policies/${created.id}`)
      .set('Authorization', `Bearer ${betaAdminToken}`);

    expect(crossRes.status).toBe(404);
  });

  test('POST /v1/policies/:id/versions creates a new version', async () => {
    const policy = await policyRepository.createPolicy({
      organizationId: testOrgId,
      name: 'Versioned Policy',
      rules: samplePolicies.modelGovernance.rules,
      createdBy: 'admin_1'
    });

    const newRules = [
      ...samplePolicies.modelGovernance.rules,
      {
        id: 'rule-new-check',
        name: 'New Check',
        effect: 'ALLOW',
        condition: { field: 'model', operator: 'eq', value: 'gpt-4o' },
        reason: 'Explicit allow in v2'
      }
    ];

    const res = await request(app)
      .post(`/v1/policies/${policy.id}/versions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        rules: newRules,
        description: 'Version 2 with expanded model access',
        activate: true
      });

    expect(res.status).toBe(201);
    expect(res.body.version).toBe(2);
  });

  test('POST /v1/policies/:id/deactivate and /activate toggles policy status', async () => {
    const policy = await policyRepository.createPolicy({
      organizationId: testOrgId,
      name: 'Toggleable Policy',
      rules: samplePolicies.modelGovernance.rules,
      createdBy: 'admin_1'
    });

    // Deactivate
    const deactRes = await request(app)
      .post(`/v1/policies/${policy.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deactRes.status).toBe(200);
    expect(deactRes.body.status).toBe('INACTIVE');

    // Activate
    const actRes = await request(app)
      .post(`/v1/policies/${policy.id}/activate`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(actRes.status).toBe(200);
    expect(actRes.body.status).toBe('ACTIVE');
  });
});
