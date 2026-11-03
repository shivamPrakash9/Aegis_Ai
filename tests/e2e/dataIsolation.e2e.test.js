// AegisAI Data Isolation and RBAC End-to-End Test Suite
// Verifies strict tenant and user isolation across all microservices:
// - Alice (Developer, Org Alpha)
// - Bob (Developer, Org Alpha)
// - Admin (Organization Admin, Org Alpha)
// - Charlie (Developer, Org Beta)

const http = require('http');
const request = require('supertest');

// Import Service Express Applications
const { app: gatewayApp } = require('../../AIGateway/src/app');
const { app: identityApp } = require('../../Identity/dist/app');
const { app: privacyApp } = require('../../PrivacyScanner/src/app');
const { app: policyApp } = require('../../PolicyApproval/src/app');
const { app: modelApp } = require('../../ModelProvider/src/app');
const auditApp = require('../../SecurityAudit/src/app');

// Import AI Gateway Downstream Clients
const { identityClient } = require('../../AIGateway/src/clients/identityClient');
const { privacyScannerClient } = require('../../AIGateway/src/clients/privacyScannerClient');
const { policyClient } = require('../../AIGateway/src/clients/policyClient');
const { modelProviderClient } = require('../../AIGateway/src/clients/modelProviderClient');
const { securityAuditClient } = require('../../AIGateway/src/clients/securityAuditClient');
const { identityClient: policyIdentityClient } = require('../../PolicyApproval/src/services/identityClient');

// Repositories for state reset
const { aiRequestRepository } = require('../../AIGateway/src/repositories/aiRequest.repository');
const { auditEventRepository } = require('../../SecurityAudit/src/repositories/auditEvent.repository');
const { approvalRepository } = require('../../PolicyApproval/src/repositories/approval.repository');
const { policyRepository } = require('../../PolicyApproval/src/repositories/policy.repository');
const { mockProvider } = require('../../ModelProvider/src/providers/mock.provider');
const { providerRegistry } = require('../../ModelProvider/src/services/providerRegistry.service');
const { userRepository } = require('../../Identity/dist/repositories/user.repository');
const { organizationRepository } = require('../../Identity/dist/repositories/organization.repository');
const { sessionService } = require('../../Identity/dist/services/session.service');
const { signAccessToken } = require('../../Identity/dist/utils/jwt');

describe('AegisAI RBAC & Multi-Tenant Data Isolation Test Suite', () => {
  let identityServer, privacyServer, policyServer, modelServer, auditServer, gatewayServer;
  let identityPort, privacyPort, policyPort, modelPort, auditPort, gatewayPort;

  const orgAlpha = 'org_alpha';
  const orgBeta = 'org_beta';

  const userAliceId = 'user_alice_alpha';
  const userBobId = 'user_bob_alpha';
  const userAdminAlphaId = 'user_admin_alpha';
  const userCharlieId = 'user_charlie_beta';

  let tokenAlice, tokenBob, tokenAdminAlpha, tokenCharlie;

  // Helper: wait for asynchronous processing to complete
  async function waitForRequestState(requestId, token, targetStatuses, maxWaitMs = 5000) {
    const start = Date.now();
    const statuses = Array.isArray(targetStatuses) ? targetStatuses : [targetStatuses];
    while (Date.now() - start < maxWaitMs) {
      const res = await request(gatewayApp)
        .get(`/v1/ai-requests/${requestId}`)
        .set('Authorization', `Bearer ${token}`);
      if (res.status === 200 && statuses.includes(res.body.status)) {
        return res;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return await request(gatewayApp)
      .get(`/v1/ai-requests/${requestId}`)
      .set('Authorization', `Bearer ${token}`);
  }

  beforeAll(async () => {
    policyRepository.setForceInMemory(true);
    approvalRepository.setForceInMemory(true);

    providerRegistry.registerModel({
      modelId: 'mock-gpt-4o',
      provider: 'mock',
      providerModelName: 'mock-gpt-4o',
      enabled: true
    });

    await new Promise((resolve) => {
      identityServer = http.createServer(identityApp).listen(0, () => {
        identityPort = identityServer.address().port;
        resolve();
      });
    });

    await new Promise((resolve) => {
      privacyServer = http.createServer(privacyApp).listen(0, () => {
        privacyPort = privacyServer.address().port;
        resolve();
      });
    });

    await new Promise((resolve) => {
      policyServer = http.createServer(policyApp).listen(0, () => {
        policyPort = policyServer.address().port;
        resolve();
      });
    });

    await new Promise((resolve) => {
      modelServer = http.createServer(modelApp).listen(0, () => {
        modelPort = modelServer.address().port;
        resolve();
      });
    });

    await new Promise((resolve) => {
      auditServer = http.createServer(auditApp).listen(0, () => {
        auditPort = auditServer.address().port;
        resolve();
      });
    });

    identityClient.baseUrl = `http://localhost:${identityPort}`;
    privacyScannerClient.baseUrl = `http://localhost:${privacyPort}`;
    policyClient.baseUrl = `http://localhost:${policyPort}`;
    modelProviderClient.baseUrl = `http://localhost:${modelPort}`;
    securityAuditClient.baseUrl = `http://localhost:${auditPort}`;
    policyIdentityClient.baseUrl = `http://localhost:${identityPort}`;

    await new Promise((resolve) => {
      gatewayServer = http.createServer(gatewayApp).listen(0, () => {
        gatewayPort = gatewayServer.address().port;
        resolve();
      });
    });

    // 1. Developer Alice in Organization Alpha
    tokenAlice = signAccessToken({
      id: userAliceId,
      organizationId: orgAlpha,
      type: 'USER',
      email: 'alice@alpha.internal',
      displayName: 'Alice Developer',
      role: 'DEVELOPER',
      permissions: ['organization:read', 'users:read']
    });

    // 2. Developer Bob in Organization Alpha
    tokenBob = signAccessToken({
      id: userBobId,
      organizationId: orgAlpha,
      type: 'USER',
      email: 'bob@alpha.internal',
      displayName: 'Bob Developer',
      role: 'DEVELOPER',
      permissions: ['organization:read', 'users:read']
    });

    // 3. Organization Administrator in Organization Alpha
    tokenAdminAlpha = signAccessToken({
      id: userAdminAlphaId,
      organizationId: orgAlpha,
      type: 'USER',
      email: 'admin@alpha.internal',
      displayName: 'Admin Alpha',
      role: 'ORGANIZATION_ADMIN',
      permissions: ['organization:read', 'organization:update', 'users:read', 'users:create', 'policies:write', 'models:write']
    });

    // 4. Developer Charlie in Organization Beta
    tokenCharlie = signAccessToken({
      id: userCharlieId,
      organizationId: orgBeta,
      type: 'USER',
      email: 'charlie@beta.internal',
      displayName: 'Charlie Developer',
      role: 'DEVELOPER',
      permissions: ['organization:read', 'users:read']
    });

    const mockUserRepo = {
      findById: async (id, orgId) => {
        if (id === userAliceId && orgId === orgAlpha) {
          return { id, organizationId: orgAlpha, role: 'DEVELOPER', status: 'ACTIVE' };
        }
        if (id === userBobId && orgId === orgAlpha) {
          return { id, organizationId: orgAlpha, role: 'DEVELOPER', status: 'ACTIVE' };
        }
        if (id === userAdminAlphaId && orgId === orgAlpha) {
          return { id, organizationId: orgAlpha, role: 'ORGANIZATION_ADMIN', status: 'ACTIVE' };
        }
        if (id === userCharlieId && orgId === orgBeta) {
          return { id, organizationId: orgBeta, role: 'DEVELOPER', status: 'ACTIVE' };
        }
        return null;
      }
    };

    const mockOrgRepo = {
      findById: async (id) => {
        if (id === orgAlpha || id === orgBeta) {
          return { id, name: id, status: 'ACTIVE' };
        }
        return null;
      }
    };

    sessionService.userRepo = mockUserRepo;
    sessionService.orgRepo = mockOrgRepo;
    jest.spyOn(userRepository, 'findById').mockImplementation(mockUserRepo.findById);
    jest.spyOn(organizationRepository, 'findById').mockImplementation(mockOrgRepo.findById);
  });

  afterAll(async () => {
    await new Promise((resolve) => identityServer.close(resolve));
    await new Promise((resolve) => privacyServer.close(resolve));
    await new Promise((resolve) => policyServer.close(resolve));
    await new Promise((resolve) => modelServer.close(resolve));
    await new Promise((resolve) => auditServer.close(resolve));
    await new Promise((resolve) => gatewayServer.close(resolve));
  });

  beforeEach(() => {
    identityClient.clearCache();
    policyIdentityClient.clearCache();
    privacyScannerClient.resetMock();
    policyClient.resetMock();
    modelProviderClient.resetMock();
    securityAuditClient.resetMocks();
    mockProvider.reset();

    identityClient.baseUrl = `http://localhost:${identityPort}`;
    privacyScannerClient.baseUrl = `http://localhost:${privacyPort}`;
    policyClient.baseUrl = `http://localhost:${policyPort}`;
    modelProviderClient.baseUrl = `http://localhost:${modelPort}`;
    securityAuditClient.baseUrl = `http://localhost:${auditPort}`;
    policyIdentityClient.baseUrl = `http://localhost:${identityPort}`;

    aiRequestRepository.clear();
    auditEventRepository.clearInMemory();
    approvalRepository.clear();
    policyRepository.clear();
  });

  // =========================================================================
  // Test 1: Alice can list and retrieve Alice's own requests
  // =========================================================================
  it('1. Alice can list and retrieve Alice\'s own requests', async () => {
    const postRes = await request(gatewayApp)
      .post('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .set('Idempotency-Key', 'alice-test-1')
      .send({
        modelPreference: { model: 'mock-gpt-4o' },
        messages: [{ role: 'user', content: 'Hello from Alice' }]
      });

    expect(postRes.status).toBe(202);
    const aliceReqId = postRes.body.requestId;
    expect(aliceReqId).toBeDefined();

    await waitForRequestState(aliceReqId, tokenAlice, ['COMPLETED', 'BLOCKED', 'WAITING_FOR_APPROVAL']);

    // Alice lists requests
    const listRes = await request(gatewayApp)
      .get('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenAlice}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].id).toBe(aliceReqId);
    expect(listRes.body.data[0].callerId).toBe(userAliceId);

    // Alice gets specific request
    const getRes = await request(gatewayApp)
      .get(`/v1/ai-requests/${aliceReqId}`)
      .set('Authorization', `Bearer ${tokenAlice}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(aliceReqId);
    expect(getRes.body.callerId).toBe(userAliceId);
  });

  // =========================================================================
  // Test 2: Alice cannot retrieve Bob's requests
  // =========================================================================
  it('2. Alice cannot retrieve Bob\'s requests', async () => {
    // Bob creates a request
    const bobPost = await request(gatewayApp)
      .post('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenBob}`)
      .set('Idempotency-Key', 'bob-test-2')
      .send({
        modelPreference: { model: 'mock-gpt-4o' },
        messages: [{ role: 'user', content: 'Bob secret calculation' }]
      });

    expect(bobPost.status).toBe(202);
    const bobReqId = bobPost.body.requestId;

    // Alice attempts to fetch Bob's request directly
    const aliceGetBob = await request(gatewayApp)
      .get(`/v1/ai-requests/${bobReqId}`)
      .set('Authorization', `Bearer ${tokenAlice}`);

    expect(aliceGetBob.status).toBe(404);

    // Alice lists requests - Bob's request must not appear
    const aliceList = await request(gatewayApp)
      .get('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenAlice}`);

    expect(aliceList.status).toBe(200);
    expect(aliceList.body.data).toHaveLength(0);
  });

  // =========================================================================
  // Test 3: Alice cannot retrieve Charlie's requests (cross-tenant)
  // =========================================================================
  it('3. Alice cannot retrieve Charlie\'s requests in Organization Beta', async () => {
    // Charlie creates a request in Beta
    const charliePost = await request(gatewayApp)
      .post('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenCharlie}`)
      .set('Idempotency-Key', 'charlie-test-3')
      .send({
        modelPreference: { model: 'mock-gpt-4o' },
        messages: [{ role: 'user', content: 'Charlie prompt in Beta' }]
      });

    expect(charliePost.status).toBe(202);
    const charlieReqId = charliePost.body.requestId;

    // Alice attempts to get Charlie's request
    const aliceGetCharlie = await request(gatewayApp)
      .get(`/v1/ai-requests/${charlieReqId}`)
      .set('Authorization', `Bearer ${tokenAlice}`);

    expect(aliceGetCharlie.status).toBe(404);

    // Alice lists requests
    const aliceList = await request(gatewayApp)
      .get('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenAlice}`);

    expect(aliceList.body.data.find((r) => r.id === charlieReqId)).toBeUndefined();
  });

  // =========================================================================
  // Test 4: Alice cannot obtain Bob's or Charlie's requests by changing query parameters
  // =========================================================================
  it('4. Alice cannot obtain Bob\'s or Charlie\'s requests by changing query parameters', async () => {
    // Create requests for Alice and Bob
    const alicePost = await request(gatewayApp)
      .post('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .set('Idempotency-Key', 'alice-test-4')
      .send({ modelPreference: { model: 'mock-gpt-4o' }, messages: [{ role: 'user', content: 'Alice query test' }] });

    const bobPost = await request(gatewayApp)
      .post('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenBob}`)
      .set('Idempotency-Key', 'bob-test-4')
      .send({ modelPreference: { model: 'mock-gpt-4o' }, messages: [{ role: 'user', content: 'Bob query test' }] });

    const aliceReqId = alicePost.body.requestId;
    const bobReqId = bobPost.body.requestId;

    // Alice tries to spoof callerId=bob in query string -> strictly rejected with 400
    const spoofCallerRes = await request(gatewayApp)
      .get(`/v1/ai-requests?callerId=${userBobId}`)
      .set('Authorization', `Bearer ${tokenAlice}`);

    expect(spoofCallerRes.status).toBe(400);

    // Alice tries to spoof organizationId=org_beta in query string -> strictly rejected with 400
    const spoofOrgRes = await request(gatewayApp)
      .get(`/v1/ai-requests?organizationId=${orgBeta}`)
      .set('Authorization', `Bearer ${tokenAlice}`);

    expect(spoofOrgRes.status).toBe(400);

    // Alice's legitimate query returns strictly Alice's request, never Bob's
    const legitList = await request(gatewayApp)
      .get('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenAlice}`);

    expect(legitList.status).toBe(200);
    expect(legitList.body.data).toHaveLength(1);
    expect(legitList.body.data[0].id).toBe(aliceReqId);
    expect(legitList.body.data.find((r) => r.id === bobReqId)).toBeUndefined();
  });

  // =========================================================================
  // Test 5: The Alpha administrator can list Alice's and Bob's requests
  // =========================================================================
  it('5. The Alpha administrator can list and retrieve Alice\'s and Bob\'s requests', async () => {
    const alicePost = await request(gatewayApp)
      .post('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .set('Idempotency-Key', 'alice-test-5')
      .send({ modelPreference: { model: 'mock-gpt-4o' }, messages: [{ role: 'user', content: 'Alice message' }] });

    const bobPost = await request(gatewayApp)
      .post('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenBob}`)
      .set('Idempotency-Key', 'bob-test-5')
      .send({ modelPreference: { model: 'mock-gpt-4o' }, messages: [{ role: 'user', content: 'Bob message' }] });

    const aliceReqId = alicePost.body.requestId;
    const bobReqId = bobPost.body.requestId;

    // Admin lists all requests in Org Alpha
    const adminList = await request(gatewayApp)
      .get('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenAdminAlpha}`);

    expect(adminList.status).toBe(200);
    expect(adminList.body.data).toHaveLength(2);
    const itemIds = adminList.body.data.map((i) => i.id);
    expect(itemIds).toContain(aliceReqId);
    expect(itemIds).toContain(bobReqId);

    // Admin can retrieve individual requests
    const adminGetAlice = await request(gatewayApp)
      .get(`/v1/ai-requests/${aliceReqId}`)
      .set('Authorization', `Bearer ${tokenAdminAlpha}`);
    expect(adminGetAlice.status).toBe(200);

    const adminGetBob = await request(gatewayApp)
      .get(`/v1/ai-requests/${bobReqId}`)
      .set('Authorization', `Bearer ${tokenAdminAlpha}`);
    expect(adminGetBob.status).toBe(200);
  });

  // =========================================================================
  // Test 6: The Alpha administrator cannot access Charlie's requests in Org Beta
  // =========================================================================
  it('6. The Alpha administrator cannot access Charlie\'s requests in Org Beta', async () => {
    const charliePost = await request(gatewayApp)
      .post('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenCharlie}`)
      .set('Idempotency-Key', 'charlie-test-6')
      .send({ modelPreference: { model: 'mock-gpt-4o' }, messages: [{ role: 'user', content: 'Charlie proprietary prompt' }] });

    const charlieReqId = charliePost.body.requestId;

    // Admin Alpha tries to retrieve Charlie's request by ID
    const adminGetCharlie = await request(gatewayApp)
      .get(`/v1/ai-requests/${charlieReqId}`)
      .set('Authorization', `Bearer ${tokenAdminAlpha}`);

    expect(adminGetCharlie.status).toBe(404);

    // Admin Alpha lists requests
    const adminList = await request(gatewayApp)
      .get('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenAdminAlpha}`);

    expect(adminList.status).toBe(200);
    expect(adminList.body.data.find((r) => r.id === charlieReqId)).toBeUndefined();
  });

  // =========================================================================
  // Test 7: The Alpha administrator cannot read Beta audit traces or approvals
  // =========================================================================
  it('7. The Alpha administrator cannot read Beta audit traces or approvals', async () => {
    // Ingest an audit event in Beta
    await auditEventRepository.save({
      eventId: 'evt_beta_exclusive',
      traceId: 'trace_beta_exclusive',
      requestId: 'req_beta_1',
      organizationId: orgBeta,
      callerId: userCharlieId,
      sourceService: 'AI_GATEWAY',
      eventType: 'REQUEST_RECEIVED',
      severity: 'INFO',
      details: { note: 'Confidential Beta event' }
    });

    // Ingest approval in Beta
    await approvalRepository.createApproval({
      id: 'appr_beta_exclusive',
      organizationId: orgBeta,
      requestId: 'req_beta_1',
      traceId: 'trace_beta_exclusive',
      requesterId: userCharlieId,
      policyId: 'pol_beta',
      ruleId: 'rule_1',
      modelRequested: 'gpt-4o',
      reason: 'Approval required for Beta'
    });

    // Admin Alpha queries audit trace for Beta
    const adminTraceRes = await request(auditApp)
      .get('/v1/traces/trace_beta_exclusive')
      .set('Authorization', `Bearer ${tokenAdminAlpha}`);

    expect(adminTraceRes.status).toBe(404);

    // Admin Alpha searches audit events
    const adminAuditSearch = await request(auditApp)
      .get('/v1/events?traceId=trace_beta_exclusive')
      .set('Authorization', `Bearer ${tokenAdminAlpha}`);

    expect(adminAuditSearch.status).toBe(200);
    expect(adminAuditSearch.body.data).toHaveLength(0);

    // Admin Alpha queries approvals
    const adminApprovalsRes = await request(policyApp)
      .get('/v1/approvals')
      .set('Authorization', `Bearer ${tokenAdminAlpha}`);

    expect(adminApprovalsRes.status).toBe(200);
    expect(adminApprovalsRes.body.items.find((a) => a.id === 'appr_beta_exclusive')).toBeUndefined();
  });

  // =========================================================================
  // Test 8: Developers cannot create, modify, or delete policies
  // =========================================================================
  it('8. Developers cannot create or modify policies unless authorized', async () => {
    // Alice (Developer) attempts to create a policy
    const alicePolicyRes = await request(policyApp)
      .post('/v1/policies')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({
        name: 'Malicious Developer Policy',
        description: 'Should be rejected',
        rules: [
          {
            id: 'rule_bad',
            name: 'Rule Bad',
            condition: { field: 'caller.role', operator: 'eq', value: 'DEVELOPER' },
            effect: 'ALLOW',
            reason: 'Malicious allow'
          }
        ]
      });

    expect(alicePolicyRes.status).toBe(403);

    // Admin Alpha creates a policy successfully
    const adminPolicyRes = await request(policyApp)
      .post('/v1/policies')
      .set('Authorization', `Bearer ${tokenAdminAlpha}`)
      .send({
        name: 'Standard Org Policy',
        description: 'Enforced policy',
        rules: [
          {
            id: 'rule_1',
            name: 'Rule 1',
            condition: { field: 'caller.role', operator: 'eq', value: 'DEVELOPER' },
            effect: 'ALLOW',
            reason: 'Allow developers'
          }
        ]
      });

    expect(adminPolicyRes.status).toBe(201);
    const createdPolicyId = adminPolicyRes.body.id;
    expect(createdPolicyId).toBeDefined();

    // Alice attempts to publish a new version of the policy
    const aliceVersionRes = await request(policyApp)
      .post(`/v1/policies/${createdPolicyId}/versions`)
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({
        rules: [
          {
            id: 'rule_v2',
            name: 'Rule V2',
            condition: { field: 'caller.role', operator: 'eq', value: 'DEVELOPER' },
            effect: 'ALLOW',
            reason: 'Allow all'
          }
        ]
      });

    expect(aliceVersionRes.status).toBe(403);
  });

  // =========================================================================
  // Test 9: Developers cannot register providers/models or read provider secrets
  // =========================================================================
  it('9. Developers cannot register providers/models or read secrets', async () => {
    // Alice attempts to register a model
    const aliceModelRes = await request(modelApp)
      .post('/v1/models')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .send({
        modelId: 'unauthorized-model',
        provider: 'mock',
        providerModelName: 'unauthorized-model'
      });

    expect(aliceModelRes.status).toBe(403);

    // Listing models does not leak API keys
    const listRes = await request(modelApp)
      .get('/v1/models')
      .set('Authorization', `Bearer ${tokenAlice}`);

    expect(listRes.status).toBe(200);
    const models = listRes.body.models || listRes.body.data || listRes.body;
    expect(Array.isArray(models)).toBe(true);
    models.forEach((m) => {
      expect(m.apiKey).toBeUndefined();
      expect(m.apiSecret).toBeUndefined();
      expect(m.clientSecret).toBeUndefined();
    });
  });

  // =========================================================================
  // Test 10: Trace and audit APIs enforce the same tenant and user restrictions
  // =========================================================================
  it('10. Trace and audit APIs enforce tenant and user restrictions', async () => {
    // Create request by Alice
    const alicePost = await request(gatewayApp)
      .post('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .set('Idempotency-Key', 'alice-test-10')
      .send({ modelPreference: { model: 'mock-gpt-4o' }, messages: [{ role: 'user', content: 'Alice trace test' }] });

    // Create request by Bob
    const bobPost = await request(gatewayApp)
      .post('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenBob}`)
      .set('Idempotency-Key', 'bob-test-10')
      .send({ modelPreference: { model: 'mock-gpt-4o' }, messages: [{ role: 'user', content: 'Bob trace test' }] });

    const aliceReqId = alicePost.body.requestId;
    const bobReqId = bobPost.body.requestId;

    // Alice accesses her own trace via Gateway
    const aliceTrace = await request(gatewayApp)
      .get(`/v1/ai-requests/${aliceReqId}/trace`)
      .set('Authorization', `Bearer ${tokenAlice}`);

    expect([200, 404]).toContain(aliceTrace.status);

    // Alice attempts to access Bob's request trace via Gateway
    const aliceTraceBob = await request(gatewayApp)
      .get(`/v1/ai-requests/${bobReqId}/trace`)
      .set('Authorization', `Bearer ${tokenAlice}`);

    expect(aliceTraceBob.status).toBe(404);
  });

  // =========================================================================
  // Test 11: Pagination and aggregate counts do not leak other users' records
  // =========================================================================
  it('11. Pagination and aggregate counts do not leak other users\' records', async () => {
    // Ingest 3 requests for Alice and 5 requests for Bob
    for (let i = 0; i < 3; i++) {
      await request(gatewayApp)
        .post('/v1/ai-requests')
        .set('Authorization', `Bearer ${tokenAlice}`)
        .set('Idempotency-Key', `alice-page-${i}`)
        .send({ modelPreference: { model: 'mock-gpt-4o' }, messages: [{ role: 'user', content: `Alice req ${i}` }] });
    }

    for (let i = 0; i < 5; i++) {
      await request(gatewayApp)
        .post('/v1/ai-requests')
        .set('Authorization', `Bearer ${tokenBob}`)
        .set('Idempotency-Key', `bob-page-${i}`)
        .send({ modelPreference: { model: 'mock-gpt-4o' }, messages: [{ role: 'user', content: `Bob req ${i}` }] });
    }

    // Alice requests page with limit 10
    const aliceRes = await request(gatewayApp)
      .get('/v1/ai-requests?limit=10&page=1')
      .set('Authorization', `Bearer ${tokenAlice}`);

    expect(aliceRes.status).toBe(200);
    expect(aliceRes.body.data).toHaveLength(3);
    // Meta count MUST strictly be 3, not 8!
    expect(aliceRes.body.pagination.total).toBe(3);

    // Bob requests page with limit 10
    const bobRes = await request(gatewayApp)
      .get('/v1/ai-requests?limit=10&page=1')
      .set('Authorization', `Bearer ${tokenBob}`);

    expect(bobRes.status).toBe(200);
    expect(bobRes.body.data).toHaveLength(5);
    expect(bobRes.body.pagination.total).toBe(5);

    // Admin Alpha sees all 8 requests
    const adminRes = await request(gatewayApp)
      .get('/v1/ai-requests?limit=10&page=1')
      .set('Authorization', `Bearer ${tokenAdminAlpha}`);

    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data).toHaveLength(8);
    expect(adminRes.body.pagination.total).toBe(8);
  });

  // =========================================================================
  // Test 12: Changing client-side role information does not grant additional permissions
  // =========================================================================
  it('12. Changing client-side role information does not grant additional permissions', async () => {
    // 1. Attempting to inject extra properties into body is rejected by strict schema validation
    const invalidBodyPost = await request(gatewayApp)
      .post('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .set('Idempotency-Key', 'spoof-test-12-a')
      .send({
        modelPreference: { model: 'mock-gpt-4o' },
        role: 'ORGANIZATION_ADMIN',
        isAdmin: true,
        callerId: userAdminAlphaId,
        messages: [{ role: 'user', content: 'Privilege escalation attempt in body' }]
      });

    expect(invalidBodyPost.status).toBe(400);

    // 2. Client sending spoofed authorization headers (e.g. X-User-Role) with valid body
    const headerSpoofPost = await request(gatewayApp)
      .post('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .set('Idempotency-Key', 'spoof-test-12-b')
      .set('X-User-Role', 'ORGANIZATION_ADMIN')
      .set('X-Is-Admin', 'true')
      .send({
        modelPreference: { model: 'mock-gpt-4o' },
        messages: [{ role: 'user', content: 'Privilege escalation attempt in header' }]
      });

    expect(headerSpoofPost.status).toBe(202);
    const spoofReqId = headerSpoofPost.body.requestId;

    // Fetch the created record - callerId must strictly be Alice, not admin
    const created = await aiRequestRepository.findById(spoofReqId, orgAlpha);
    expect(created.callerId).toBe(userAliceId);

    // 3. Alice attempts to use policy administration with spoofed headers -> rejected with 403
    const spoofPolicyRes = await request(policyApp)
      .post('/v1/policies')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .set('X-User-Role', 'ORGANIZATION_ADMIN')
      .send({
        name: 'Header Spoof Policy',
        description: 'Should fail',
        rules: [
          {
            id: 'rule_1',
            name: 'Rule 1',
            condition: { field: 'caller.role', operator: 'eq', value: 'DEVELOPER' },
            effect: 'ALLOW',
            reason: 'Allow'
          }
        ]
      });

    expect(spoofPolicyRes.status).toBe(403);
  });
});
