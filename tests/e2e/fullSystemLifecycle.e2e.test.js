// AegisAI Full-System End-to-End Integration Test Suite (Hardened & Reconciled)
// Verifies live HTTP interactions across all six microservices:
// Client -> Identity -> AI Gateway -> Privacy Scanner -> Policy & Approval -> Model & Provider -> Security & Audit

const http = require('http');
const request = require('supertest');
const jwt = require('../../Identity/node_modules/jsonwebtoken');

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

// Import Repositories and Services for State Teardown & Mock Users
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
const { config: identityConfig } = require('../../Identity/dist/config/env');

describe('AegisAI Full-System End-to-End Integration Suite', () => {
  let identityServer, privacyServer, policyServer, modelServer, auditServer, gatewayServer;
  let identityPort, privacyPort, policyPort, modelPort, auditPort, gatewayPort;

  const orgAlpha = 'org_enterprise_alpha';
  const orgBeta = 'org_enterprise_beta';
  const userAliceId = 'user_alice_dev';
  const userBobId = 'user_bob_dev';
  const adminId = 'user_admin_lead';

  let tokenAlice, tokenBob, tokenAdmin;

  // Helper: Bounded polling to wait for asynchronous requests to reach expected terminal state
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
    // Return final attempt for assertions
    return await request(gatewayApp)
      .get(`/v1/ai-requests/${requestId}`)
      .set('Authorization', `Bearer ${token}`);
  }

  beforeAll(async () => {
    // Ensure in-memory fallback for testing
    policyRepository.setForceInMemory(true);
    approvalRepository.setForceInMemory(true);

    // Register test models in ModelProvider registry
    providerRegistry.registerModel({
      modelId: 'approval-required-model',
      provider: 'mock',
      providerModelName: 'approval-required-model',
      enabled: true
    });
    providerRegistry.registerModel({
      modelId: 'gpt-4o',
      provider: 'mock',
      providerModelName: 'gpt-4o',
      enabled: true
    });

    // 1. Start live HTTP servers on dynamic ports for all downstream microservices
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

    // 2. Wire Gateway client adapters to the real running HTTP servers
    identityClient.baseUrl = `http://localhost:${identityPort}`;
    privacyScannerClient.baseUrl = `http://localhost:${privacyPort}`;
    policyClient.baseUrl = `http://localhost:${policyPort}`;
    modelProviderClient.baseUrl = `http://localhost:${modelPort}`;
    securityAuditClient.baseUrl = `http://localhost:${auditPort}`;
    policyIdentityClient.baseUrl = `http://localhost:${identityPort}`;

    // 3. Start AI Gateway HTTP server
    await new Promise((resolve) => {
      gatewayServer = http.createServer(gatewayApp).listen(0, () => {
        gatewayPort = gatewayServer.address().port;
        resolve();
      });
    });

    // 4. Generate valid Identity JWT access tokens
    tokenAlice = signAccessToken({
      id: userAliceId,
      organizationId: orgAlpha,
      type: 'USER',
      email: 'alice@alpha.enterprise',
      displayName: 'Alice Developer',
      role: 'DEVELOPER',
      permissions: ['organization:read', 'users:read']
    });

    tokenBob = signAccessToken({
      id: userBobId,
      organizationId: orgBeta,
      type: 'USER',
      email: 'bob@beta.enterprise',
      displayName: 'Bob Developer',
      role: 'DEVELOPER',
      permissions: ['organization:read', 'users:read']
    });

    tokenAdmin = signAccessToken({
      id: adminId,
      organizationId: orgAlpha,
      type: 'USER',
      email: 'admin@alpha.enterprise',
      displayName: 'Admin Lead',
      role: 'ORGANIZATION_ADMIN',
      permissions: ['organization:read', 'organization:update', 'users:read', 'users:create']
    });

    const mockUserRepo = {
      findById: async (id, orgId) => {
        if (id === userAliceId && orgId === orgAlpha) {
          return {
            id: userAliceId,
            organizationId: orgAlpha,
            email: 'alice@alpha.enterprise',
            passwordHash: 'hash',
            displayName: 'Alice Developer',
            role: 'DEVELOPER',
            status: 'ACTIVE',
            lastLoginAt: null,
            createdAt: new Date(),
            updatedAt: new Date()
          };
        }
        if (id === userBobId && orgId === orgBeta) {
          return {
            id: userBobId,
            organizationId: orgBeta,
            email: 'bob@beta.enterprise',
            passwordHash: 'hash',
            displayName: 'Bob Developer',
            role: 'DEVELOPER',
            status: 'ACTIVE',
            lastLoginAt: null,
            createdAt: new Date(),
            updatedAt: new Date()
          };
        }
        if (id === adminId && orgId === orgAlpha) {
          return {
            id: adminId,
            organizationId: orgAlpha,
            email: 'admin@alpha.enterprise',
            passwordHash: 'hash',
            displayName: 'Admin Lead',
            role: 'ORGANIZATION_ADMIN',
            status: 'ACTIVE',
            lastLoginAt: null,
            createdAt: new Date(),
            updatedAt: new Date()
          };
        }
        return null;
      }
    };

    const mockOrgRepo = {
      findById: async (id) => {
        if (id === orgAlpha || id === orgBeta) {
          return {
            id,
            name: id === orgAlpha ? 'Alpha Org' : 'Beta Org',
            slug: id === orgAlpha ? 'alpha-org' : 'beta-org',
            status: 'ACTIVE',
            createdAt: new Date(),
            updatedAt: new Date()
          };
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
    // Close all test servers cleanly
    await new Promise((resolve) => identityServer.close(resolve));
    await new Promise((resolve) => privacyServer.close(resolve));
    await new Promise((resolve) => policyServer.close(resolve));
    await new Promise((resolve) => modelServer.close(resolve));
    await new Promise((resolve) => auditServer.close(resolve));
    await new Promise((resolve) => gatewayServer.close(resolve));
  });

  beforeEach(() => {
    // Reset any Gateway client mocks to ensure real HTTP calls
    identityClient.clearCache();
    policyIdentityClient.clearCache();
    privacyScannerClient.resetMock();
    policyClient.resetMock();
    modelProviderClient.resetMock();
    securityAuditClient.resetMocks();
    mockProvider.reset();

    // Reset base URLs to real test servers
    identityClient.baseUrl = `http://localhost:${identityPort}`;
    privacyScannerClient.baseUrl = `http://localhost:${privacyPort}`;
    policyClient.baseUrl = `http://localhost:${policyPort}`;
    modelProviderClient.baseUrl = `http://localhost:${modelPort}`;
    securityAuditClient.baseUrl = `http://localhost:${auditPort}`;
    policyIdentityClient.baseUrl = `http://localhost:${identityPort}`;

    // Clear repositories
    aiRequestRepository.clear();
    auditEventRepository.clearInMemory();
    approvalRepository.clear();
    policyRepository.clear();
  });

  afterEach(() => {
    // Teardown cleanup guaranteeing pristine state for next test
    mockProvider.reset();
    privacyScannerClient.resetMock();
    policyClient.resetMock();
    modelProviderClient.resetMock();
    securityAuditClient.resetMocks();

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
  // Scenario 1: Successful AI Request (Happy Path)
  // =========================================================================
  it('Scenario 1: executes full request lifecycle successfully (Identity -> Gateway -> Privacy -> Policy -> Model -> Audit)', async () => {
    const res = await request(gatewayApp)
      .post('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .set('Idempotency-Key', 'e2e-happy-1')
      .send({
        messages: [{ role: 'user', content: 'Explain binary search algorithm.' }],
        modelPreference: { model: 'mock-gpt-4o' }
      });

    expect(res.status).toBe(202);
    expect(res.body.requestId).toBeDefined();
    expect(res.body.status).toBe('ACCEPTED');
    expect(res.body.traceId).toBeDefined();

    const { requestId, traceId } = res.body;

    // Bounded polling for terminal state
    const getRes = await waitForRequestState(requestId, tokenAlice, 'COMPLETED');

    expect(getRes.status).toBe(200);
    expect(getRes.body.status).toBe('COMPLETED');
    expect(getRes.body.modelSelected).toBe('mock-gpt-4o');
    expect(getRes.body.sanitizedResult).toBeDefined();
    expect(mockProvider.invocationCount).toBe(1);

    // Verify audit trace in SecurityAudit service
    const traceRes = await request(auditApp)
      .get(`/v1/traces/${traceId}?organizationId=${orgAlpha}`)
      .set('X-Internal-Service-Key', 'aegis_internal_service_secret_key_dev');

    expect(traceRes.status).toBe(200);
    expect(traceRes.body.traceId).toBe(traceId);
    expect(traceRes.body.events.length).toBeGreaterThanOrEqual(2);

    const eventTypes = traceRes.body.events.map((e) => e.eventType);
    expect(eventTypes).toContain('AI_REQUEST_ACCEPTED');
    expect(eventTypes).toContain('AI_REQUEST_COMPLETED');
  });

  // =========================================================================
  // Scenario 2: Privacy Masking
  // =========================================================================
  it('Scenario 2: masks sensitive email and ensures model only receives sanitized content', async () => {
    const syntheticEmail = 'contact.testing@enterprise.internal';
    const rawPrompt = `Please send report to ${syntheticEmail} immediately.`;

    const res = await request(gatewayApp)
      .post('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .set('Idempotency-Key', 'e2e-mask-1')
      .send({
        messages: [{ role: 'user', content: rawPrompt }],
        modelPreference: { model: 'mock-gpt-4o' }
      });

    expect(res.status).toBe(202);
    const { requestId, traceId } = res.body;

    const getRes = await waitForRequestState(requestId, tokenAlice, 'COMPLETED');

    expect(getRes.status).toBe(200);
    expect(getRes.body.status).toBe('COMPLETED');
    expect(getRes.body.privacyAction).toBe('MASK');

    // Assert provider strictly received sanitized content, NEVER the raw synthetic email
    expect(mockProvider.invocationCount).toBe(1);
    expect(mockProvider.lastInvokedMessages.length).toBeGreaterThan(0);
    expect(mockProvider.lastInvokedMessages[0].content).not.toContain(syntheticEmail);
    expect(mockProvider.lastInvokedMessages[0].content).toContain('[EMAIL_1]');

    // Verify audit trace contains ZERO occurrences of raw synthetic email
    const traceRes = await request(auditApp)
      .get(`/v1/traces/${traceId}?organizationId=${orgAlpha}`)
      .set('X-Internal-Service-Key', 'aegis_internal_service_secret_key_dev');

    expect(traceRes.status).toBe(200);
    const traceJson = JSON.stringify(traceRes.body);
    expect(traceJson).not.toContain(syntheticEmail);
  });

  // =========================================================================
  // Scenario 3: Privacy Blocking
  // =========================================================================
  it('Scenario 3: blocks request when secret credentials are detected and halts model invocation', async () => {
    const syntheticSecret = 'AKIAIOSFODNN7EXAMPLE'; // Standard AWS Access Key pattern (20 characters)

    const res = await request(gatewayApp)
      .post('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .set('Idempotency-Key', 'e2e-block-secret-1')
      .send({
        messages: [{ role: 'user', content: `Here is my key: ${syntheticSecret}` }],
        modelPreference: { model: 'mock-gpt-4o' }
      });

    expect(res.status).toBe(202);
    const { requestId, traceId } = res.body;

    const getRes = await waitForRequestState(requestId, tokenAlice, 'BLOCKED');

    expect(getRes.status).toBe(200);
    expect(getRes.body.status).toBe('BLOCKED');
    expect(getRes.body.privacyAction).toBe('BLOCK');
    expect(getRes.body.sanitizedResult).toBeNull();

    // Assert model provider was NEVER invoked
    expect(mockProvider.invocationCount).toBe(0);

    // Verify audit event AI_REQUEST_BLOCKED_PRIVACY was recorded without leaking secret
    const traceRes = await request(auditApp)
      .get(`/v1/traces/${traceId}?organizationId=${orgAlpha}`)
      .set('X-Internal-Service-Key', 'aegis_internal_service_secret_key_dev');

    expect(traceRes.status).toBe(200);
    const eventTypes = traceRes.body.events.map((e) => e.eventType);
    expect(eventTypes).toContain('AI_REQUEST_BLOCKED_PRIVACY');
    expect(JSON.stringify(traceRes.body)).not.toContain(syntheticSecret);
  });

  // =========================================================================
  // Scenario 4: Policy Denial
  // =========================================================================
  it('Scenario 4: enforces policy DENY, halting pipeline with zero model provider calls', async () => {
    // Configure policy in PolicyApproval that denies restricted frontier model
    await policyRepository.createPolicy({
      organizationId: orgAlpha,
      name: 'Frontier Model Restriction',
      priority: 100,
      rules: [
        {
          id: 'rule_deny_frontier',
          name: 'Deny Frontier Models',
          priority: 100,
          effect: 'DENY',
          reason: 'Frontier models are strictly prohibited for developers.',
          condition: {
            field: 'model',
            operator: 'eq',
            value: 'restricted-frontier-model'
          }
        }
      ],
      createdBy: 'test-admin'
    });

    const res = await request(gatewayApp)
      .post('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .set('Idempotency-Key', 'e2e-policy-deny-1')
      .send({
        messages: [{ role: 'user', content: 'Summarize financial reports.' }],
        modelPreference: { model: 'restricted-frontier-model' }
      });

    expect(res.status).toBe(202);
    const { requestId, traceId } = res.body;

    const getRes = await waitForRequestState(requestId, tokenAlice, 'BLOCKED');

    expect(getRes.status).toBe(200);
    expect(getRes.body.status).toBe('BLOCKED');
    expect(getRes.body.policyDecision).toBe('DENY');
    expect(getRes.body.sanitizedResult).toBeNull();

    // Assert model provider was NEVER invoked
    expect(mockProvider.invocationCount).toBe(0);

    // Verify audit record contains AI_REQUEST_BLOCKED_POLICY
    const traceRes = await request(auditApp)
      .get(`/v1/traces/${traceId}?organizationId=${orgAlpha}`)
      .set('X-Internal-Service-Key', 'aegis_internal_service_secret_key_dev');

    expect(traceRes.status).toBe(200);
    const eventTypes = traceRes.body.events.map((e) => e.eventType);
    expect(eventTypes).toContain('AI_REQUEST_BLOCKED_POLICY');
  });

  // =========================================================================
  // Scenario 5: Approval Required (Suspension, Reviewer Decision, and Resume)
  // =========================================================================
  it('Scenario 5: suspends request on REQUIRE_APPROVAL, prevents model invocation, and completes upon human approval', async () => {
    // Configure policy requiring approval for high-risk models
    await policyRepository.createPolicy({
      organizationId: orgAlpha,
      name: 'High Risk Model Approval',
      priority: 90,
      rules: [
        {
          id: 'rule_require_approval',
          name: 'Approval Required for Frontier Models',
          priority: 90,
          effect: 'REQUIRE_APPROVAL',
          reason: 'Frontier model usage requires lead approval.',
          condition: {
            field: 'model',
            operator: 'eq',
            value: 'approval-required-model'
          }
        }
      ],
      createdBy: 'test-admin'
    });

    // 1. Submit request triggering REQUIRE_APPROVAL
    const submitRes = await request(gatewayApp)
      .post('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .set('Idempotency-Key', 'e2e-approval-flow-1')
      .send({
        messages: [{ role: 'user', content: 'Generate quarterly projection summary.' }],
        modelPreference: { model: 'approval-required-model' }
      });

    expect(submitRes.status).toBe(202);
    const requestId = submitRes.body.requestId;

    // 2. Verify Gateway status is WAITING_FOR_APPROVAL and NO model result exists
    const statusRes = await waitForRequestState(requestId, tokenAlice, 'WAITING_FOR_APPROVAL');

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.status).toBe('WAITING_FOR_APPROVAL');
    expect(statusRes.body.sanitizedResult).toBeNull();

    // Assert model provider call count remains zero before approval
    expect(mockProvider.invocationCount).toBe(0);

    // 3. Find the pending approval correlated specifically to this Gateway requestId
    const approvalsRes = await request(policyApp)
      .get('/v1/approvals')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(approvalsRes.status).toBe(200);
    const approval = approvalsRes.body.items.find((item) => item.requestId === requestId);
    expect(approval).toBeDefined();
    expect(approval.status).toBe('PENDING');
    expect(approval.organizationId).toBe(orgAlpha);

    // 4. Authorized approver reviews and approves the request
    const decisionRes = await request(policyApp)
      .post(`/v1/approvals/${approval.id}/decision`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        decision: 'APPROVED',
        reason: 'Authorized for executive presentation'
      });

    expect(decisionRes.status).toBe(200);
    expect(decisionRes.body.status).toBe('APPROVED');

    // 5. Resume the approved request via Gateway resume endpoint
    const resumeRes = await request(gatewayApp)
      .post(`/v1/ai-requests/${requestId}/resume`)
      .set('Authorization', `Bearer ${tokenAlice}`);

    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body.status).toBe('COMPLETED');
    expect(resumeRes.body.approvalStatus).toBe('APPROVED');
    expect(resumeRes.body.sanitizedResult).toBeDefined();

    // Assert model provider was invoked upon approval
    expect(mockProvider.invocationCount).toBe(1);

    // Verify terminal state in Gateway
    const finalRes = await waitForRequestState(requestId, tokenAlice, 'COMPLETED');
    expect(finalRes.status).toBe(200);
    expect(finalRes.body.status).toBe('COMPLETED');
  });

  it('Scenario 5b: rejected approval transitions request to BLOCKED and prevents model execution', async () => {
    await policyRepository.createPolicy({
      organizationId: orgAlpha,
      name: 'High Risk Model Approval',
      priority: 90,
      rules: [
        {
          id: 'rule_require_approval',
          name: 'Approval Required for Frontier Models',
          priority: 90,
          effect: 'REQUIRE_APPROVAL',
          reason: 'Frontier model usage requires lead approval.',
          condition: {
            field: 'model',
            operator: 'eq',
            value: 'approval-required-model'
          }
        }
      ],
      createdBy: 'test-admin'
    });

    const submitRes = await request(gatewayApp)
      .post('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .set('Idempotency-Key', 'e2e-approval-reject-1')
      .send({
        messages: [{ role: 'user', content: 'Generate executive forecast.' }],
        modelPreference: { model: 'approval-required-model' }
      });

    expect(submitRes.status).toBe(202);
    const requestId = submitRes.body.requestId;

    await waitForRequestState(requestId, tokenAlice, 'WAITING_FOR_APPROVAL');
    expect(mockProvider.invocationCount).toBe(0);

    const approvalsRes = await request(policyApp)
      .get('/v1/approvals')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    const approval = approvalsRes.body.items.find((item) => item.requestId === requestId);
    expect(approval).toBeDefined();

    // Approver REJECTS the request
    const rejectRes = await request(policyApp)
      .post(`/v1/approvals/${approval.id}/decision`)
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        decision: 'REJECTED',
        reason: 'Budget constraint for Q4'
      });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.status).toBe('REJECTED');

    // Resume attempt updates status to BLOCKED
    const resumeRes = await request(gatewayApp)
      .post(`/v1/ai-requests/${requestId}/resume`)
      .set('Authorization', `Bearer ${tokenAlice}`);

    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body.status).toBe('BLOCKED');
    expect(resumeRes.body.approvalStatus).toBe('REJECTED');

    // Assert model provider invocation count strictly remains zero
    expect(mockProvider.invocationCount).toBe(0);
  });

  // =========================================================================
  // Scenario 6: Invalid Authentication & Security Edge Cases
  // =========================================================================
  it('Scenario 6: strictly rejects missing, invalid, or expired credentials with 401', async () => {
    // 1. Missing Authorization header
    const resNoAuth = await request(gatewayApp)
      .post('/v1/ai-requests')
      .set('Idempotency-Key', 'auth-fail-1')
      .send({
        messages: [{ role: 'user', content: 'Hello' }]
      });

    expect(resNoAuth.status).toBe(401);

    // 2. Invalid Token String
    const resInvalidAuth = await request(gatewayApp)
      .post('/v1/ai-requests')
      .set('Authorization', 'Bearer invalid_garbage_token_string')
      .set('Idempotency-Key', 'auth-fail-2')
      .send({
        messages: [{ role: 'user', content: 'Hello' }]
      });

    expect(resInvalidAuth.status).toBe(401);

    // 3. Expired Token
    const expiredToken = jwt.sign(
      {
        sub: userAliceId,
        iss: identityConfig.jwt.issuer,
        aud: identityConfig.jwt.audience,
        org_id: orgAlpha,
        type: 'USER',
        email: 'alice@alpha.enterprise',
        displayName: 'Alice Developer',
        role: 'DEVELOPER',
        permissions: ['organization:read']
      },
      identityConfig.jwt.accessSecret,
      { expiresIn: '-10s' }
    );

    const resExpired = await request(gatewayApp)
      .post('/v1/ai-requests')
      .set('Authorization', `Bearer ${expiredToken}`)
      .set('Idempotency-Key', 'auth-fail-3')
      .send({
        messages: [{ role: 'user', content: 'Hello' }]
      });

    expect(resExpired.status).toBe(401);

    // 4. Untrusted Correlation ID header alone cannot authenticate
    const resCorrelationOnly = await request(gatewayApp)
      .post('/v1/ai-requests')
      .set('X-Correlation-Id', 'attacker-spoofed-correlation-id')
      .set('Idempotency-Key', 'auth-fail-4')
      .send({
        messages: [{ role: 'user', content: 'Hello' }]
      });

    expect(resCorrelationOnly.status).toBe(401);
  });

  // =========================================================================
  // Scenario 7: Cross-Tenant Isolation
  // =========================================================================
  it('Scenario 7: strictly enforces cross-tenant data isolation across all endpoints', async () => {
    // Tenant A submits an AI request
    const resA = await request(gatewayApp)
      .post('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .set('Idempotency-Key', 'tenant-a-request-1')
      .send({
        messages: [{ role: 'user', content: 'Tenant A private data calculation.' }]
      });

    expect(resA.status).toBe(202);
    const requestAId = resA.body.requestId;
    const traceAId = resA.body.traceId;

    // Tenant B attempts to read Tenant A's request -> 404
    const resBGet = await request(gatewayApp)
      .get(`/v1/ai-requests/${requestAId}`)
      .set('Authorization', `Bearer ${tokenBob}`);

    expect(resBGet.status).toBe(404);

    // Tenant B attempts to read Tenant A's trace -> 404
    const resBTrace = await request(gatewayApp)
      .get(`/v1/ai-requests/${requestAId}/trace`)
      .set('Authorization', `Bearer ${tokenBob}`);

    expect(resBTrace.status).toBe(404);

    // Tenant B attempts to query Security & Audit directly for Tenant A trace -> 404
    const resAuditDirect = await request(auditApp)
      .get(`/v1/traces/${traceAId}`)
      .set('Authorization', `Bearer ${tokenBob}`);

    expect(resAuditDirect.status).toBe(404);

    // Tenant B attempts to list approvals -> must NOT see Tenant A approvals
    const resBApprovals = await request(policyApp)
      .get('/v1/approvals')
      .set('Authorization', `Bearer ${tokenBob}`);

    expect(resBApprovals.status).toBe(200);
    const leakedItem = resBApprovals.body.items.find((item) => item.organizationId === orgAlpha);
    expect(leakedItem).toBeUndefined();
  });

  // =========================================================================
  // Scenario 8: Downstream Service Unavailable (Fail-Closed Boundaries)
  // =========================================================================
  it('Scenario 8: fails safely with 503 when Privacy Scanner or Policy Service is unreachable', async () => {
    // 1. Temporarily point privacyScannerClient to unreachable port
    privacyScannerClient.baseUrl = 'http://localhost:59999';

    const res = await request(gatewayApp)
      .post('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .set('Idempotency-Key', 'fail-closed-privacy-1')
      .send({
        messages: [{ role: 'user', content: 'Check this prompt.' }]
      });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');

    // 2. Restore Privacy Scanner, then break Policy Service
    privacyScannerClient.baseUrl = `http://localhost:${privacyPort}`;
    policyClient.baseUrl = 'http://localhost:59999';

    const resPolicyDown = await request(gatewayApp)
      .post('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .set('Idempotency-Key', 'fail-closed-policy-1')
      .send({
        messages: [{ role: 'user', content: 'Check this prompt.' }]
      });

    expect(resPolicyDown.status).toBe(503);
    expect(resPolicyDown.error.code || resPolicyDown.body.error.code).toBe('SERVICE_UNAVAILABLE');

    // Assert model provider call count remains zero on downstream failure
    expect(mockProvider.invocationCount).toBe(0);
  });

  // =========================================================================
  // Scenario 9: Model Provider Failure Mapping
  // =========================================================================
  it('Scenario 9: correctly maps model provider timeout to 504 and records failure state', async () => {
    mockProvider.setSimulatedError('TIMEOUT');

    const res = await request(gatewayApp)
      .post('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .set('Idempotency-Key', 'timeout-test-1')
      .send({
        messages: [{ role: 'user', content: 'Simulate timeout prompt.' }],
        modelPreference: { model: 'mock-gpt-4o' }
      });

    mockProvider.reset();

    expect(res.status).toBe(504);
    expect(res.body.error.code).toBe('GATEWAY_TIMEOUT');
  });

  // =========================================================================
  // Scenario 10: Audit Duplicate and Resilience Behavior
  // =========================================================================
  it('Scenario 10: deduplicates repeated audit events and handles best-effort delivery', async () => {
    const eventPayload = {
      eventId: 'evt_dedup_e2e_1',
      eventType: 'AI_REQUEST_COMPLETED',
      organizationId: orgAlpha,
      requestId: 'req_dedup_e2e_1',
      traceId: 'trace_dedup_e2e_1',
      severity: 'INFO',
      details: { tokens: 10 }
    };

    // First emission: 201 PERSISTED
    const res1 = await request(auditApp)
      .post('/v1/events')
      .set('X-Internal-Service-Key', 'aegis_internal_service_secret_key_dev')
      .send(eventPayload);

    expect(res1.status).toBe(201);
    expect(res1.body.status).toBe('PERSISTED');

    // Duplicate emission: 200 DUPLICATE
    const res2 = await request(auditApp)
      .post('/v1/events')
      .set('X-Internal-Service-Key', 'aegis_internal_service_secret_key_dev')
      .send(eventPayload);

    expect(res2.status).toBe(200);
    expect(res2.body.status).toBe('DUPLICATE');
  });

  // =========================================================================
  // Scenario 11: Request and Trace Consistency
  // =========================================================================
  it('Scenario 11: verifies consistent trace IDs, chronological timestamps, and clean audit logs', async () => {
    const res = await request(gatewayApp)
      .post('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .set('Idempotency-Key', 'trace-consistency-1')
      .send({
        messages: [{ role: 'user', content: 'Explain architectural patterns.' }]
      });

    expect(res.status).toBe(202);
    const { requestId, traceId } = res.body;

    await waitForRequestState(requestId, tokenAlice, 'COMPLETED');

    const traceRes = await request(auditApp)
      .get(`/v1/traces/${traceId}?organizationId=${orgAlpha}`)
      .set('X-Internal-Service-Key', 'aegis_internal_service_secret_key_dev');

    expect(traceRes.status).toBe(200);
    expect(traceRes.body.traceId).toBe(traceId);
    expect(traceRes.body.requestId).toBe(requestId);

    const events = traceRes.body.events;
    expect(events.length).toBeGreaterThanOrEqual(2);

    // Verify chronological ordering
    const time1 = new Date(events[0].timestamp).getTime();
    const time2 = new Date(events[1].timestamp).getTime();
    expect(time2).toBeGreaterThanOrEqual(time1);

    // Verify zero raw prompts or sensitive completions leaked in trace
    const serializedTrace = JSON.stringify(traceRes.body);
    expect(serializedTrace).not.toContain('Explain architectural patterns.');
  });

  // =========================================================================
  // Scenario 12: Idempotency and Rate Limits
  // =========================================================================
  it('Scenario 12: deduplicates idempotent requests without re-invoking downstream pipeline', async () => {
    const idempotencyKey = 'e2e-dedup-replay-1';
    const payload = {
      messages: [{ role: 'user', content: 'Generate idempotency demonstration.' }]
    };

    // First submission
    const res1 = await request(gatewayApp)
      .post('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(res1.status).toBe(202);
    expect(mockProvider.invocationCount).toBe(1);

    // Exact replay with same idempotency key and same payload
    const res2 = await request(gatewayApp)
      .post('/v1/ai-requests')
      .set('Authorization', `Bearer ${tokenAlice}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(res2.status).toBe(202);
    expect(res2.body.requestId).toBe(res1.body.requestId);
    expect(res2.body.traceId).toBe(res1.body.traceId);

    // Verify model was NOT invoked again (count remains 1)
    expect(mockProvider.invocationCount).toBe(1);
  });
});
