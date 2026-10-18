// Integration Tests: Multi-Tenant Isolation & Resource Scoping

const request = require('supertest');
const { app } = require('../../src/app');
const { identityClient } = require('../../src/clients/identityClient');
const { privacyScannerClient } = require('../../src/clients/privacyScannerClient');
const { policyClient } = require('../../src/clients/policyClient');
const { modelProviderClient } = require('../../src/clients/modelProviderClient');
const { securityAuditClient } = require('../../src/clients/securityAuditClient');
const { aiRequestRepository } = require('../../src/repositories/aiRequest.repository');
const {
  mockUserPrincipal,
  mockTenantBPrincipal,
  mockValidAiPayload
} = require('../fixtures/mockData');

describe('Multi-Tenant Isolation and Access Scoping Tests', () => {
  const tokenTenantA = 'token_org_a';
  const tokenTenantB = 'token_org_b';

  beforeEach(() => {
    if (aiRequestRepository.clear) {
      aiRequestRepository.clear();
    }

    // Mock Identity Service returning distinct organization principals
    jest.spyOn(identityClient, 'verifySession').mockImplementation(async (token) => {
      if (token === tokenTenantA) {
        return {
          valid: true,
          principal: { ...mockUserPrincipal, organizationId: 'org_tenant_a' }
        };
      }
      if (token === tokenTenantB) {
        return {
          valid: true,
          principal: { ...mockTenantBPrincipal, organizationId: 'org_tenant_b' }
        };
      }
      const { UnauthorizedError } = require('../../src/utils/errors');
      throw new UnauthorizedError('Unauthorized');
    });

    privacyScannerClient.setMockHandler(async ({ messages }) => ({
      action: 'ALLOW',
      sanitizedMessages: messages
    }));

    policyClient.setMockHandler(async () => ({ decision: 'ALLOW' }));

    modelProviderClient.setMockHandler(async () => ({
      model: 'gpt-4o',
      choices: [{ message: { role: 'assistant', content: 'Safe completion.' } }]
    }));

    securityAuditClient.setMockTraceHandler(async (traceId) => ({
      traceId,
      events: [{ eventType: 'COMPLETED', timestamp: new Date().toISOString() }]
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    privacyScannerClient.resetMock();
    policyClient.resetMock();
    modelProviderClient.resetMock();
    securityAuditClient.resetMocks();
  });

  it('SECURITY REGRESSION: Tenant B must receive 404 when querying Tenant A request by ID', async () => {
    // Tenant A submits an AI request
    const postRes = await request(app)
      .post('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenTenantA}`)
      .set('Idempotency-Key', 'tenant-a-key-1')
      .send(mockValidAiPayload);

    expect(postRes.status).toBe(202);
    const tenantARequestId = postRes.body.requestId;

    // Tenant A can retrieve their own request
    const tenantAGet = await request(app)
      .get(`/v1/ai-requests/${tenantARequestId}`)
      .set('Authorization', `Bearer ${tokenTenantA}`);

    expect(tenantAGet.status).toBe(200);
    expect(tenantAGet.body.id).toBe(tenantARequestId);

    // Tenant B attempts to access Tenant A's request -> MUST be 404
    const tenantBGet = await request(app)
      .get(`/v1/ai-requests/${tenantARequestId}`)
      .set('Authorization', `Bearer ${tokenTenantB}`);

    expect(tenantBGet.status).toBe(404);
    expect(tenantBGet.body.error.code).toBe('NOT_FOUND');
  });

  it('SECURITY REGRESSION: Tenant request listing strictly scopes data to caller organization', async () => {
    // Submit request for Tenant A
    await request(app)
      .post('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenTenantA}`)
      .set('Idempotency-Key', 'a-key-1')
      .send(mockValidAiPayload);

    // Submit request for Tenant B
    await request(app)
      .post('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenTenantB}`)
      .set('Idempotency-Key', 'b-key-1')
      .send(mockValidAiPayload);

    // List for Tenant A
    const listA = await request(app)
      .get('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenTenantA}`);

    expect(listA.status).toBe(200);
    expect(listA.body.data).toHaveLength(1);
    expect(listA.body.pagination.total).toBe(1);

    // List for Tenant B
    const listB = await request(app)
      .get('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenTenantB}`);

    expect(listB.status).toBe(200);
    expect(listB.body.data).toHaveLength(1);
    expect(listB.body.pagination.total).toBe(1);

    // Ensure IDs are different
    expect(listA.body.data[0].id).not.toBe(listB.body.data[0].id);
  });

  it('SECURITY REGRESSION: Tenant B must receive 404 when requesting trace for Tenant A request', async () => {
    const postRes = await request(app)
      .post('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenTenantA}`)
      .set('Idempotency-Key', 'trace-isolation-key')
      .send(mockValidAiPayload);

    const tenantARequestId = postRes.body.requestId;

    // Tenant B attempts to fetch trace
    const res = await request(app)
      .get(`/v1/ai-requests/${tenantARequestId}/trace`)
      .set('Authorization', `Bearer ${tokenTenantB}`);

    expect(res.status).toBe(404);
  });
});
