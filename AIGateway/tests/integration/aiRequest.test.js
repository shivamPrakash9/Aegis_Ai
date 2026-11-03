// Integration Tests: AI Request Submission & End-to-End Orchestration Pipeline

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
  mockValidAiPayload
} = require('../fixtures/mockData');

describe('AI Request Pipeline Integration Tests', () => {
  const validToken = 'valid_test_token_123';
  let providerCalls = 0;
  let auditEvents = [];

  beforeEach(() => {
    providerCalls = 0;
    auditEvents = [];

    // Reset repository in-memory store
    if (aiRequestRepository.clear) {
      aiRequestRepository.clear();
    }

    // Mock Identity Service
    jest.spyOn(identityClient, 'verifySession').mockImplementation(async (token) => {
      if (token === validToken) {
        return {
          valid: true,
          principal: { ...mockUserPrincipal }
        };
      }
      const { UnauthorizedError } = require('../../src/utils/errors');
      throw new UnauthorizedError('Credential verification failed: invalid token.');
    });

    // Default Privacy Scanner: ALLOW
    privacyScannerClient.setMockHandler(async ({ messages }) => ({
      action: 'ALLOW',
      sanitizedMessages: messages
    }));

    // Default Policy Service: ALLOW
    policyClient.setMockHandler(async () => ({
      decision: 'ALLOW'
    }));

    // Default Model Provider: Mock completion
    modelProviderClient.setMockHandler(async ({ messages, modelPreference }) => {
      providerCalls += 1;
      return {
        model: modelPreference?.model || 'gpt-4o',
        provider: 'openai',
        choices: [
          { message: { role: 'assistant', content: 'Zero trust means never trust, always verify.' } }
        ],
        usage: { promptTokens: 15, completionTokens: 10, totalTokens: 25 }
      };
    });

    // Mock Audit Service
    securityAuditClient.setMockHandler(async (evt) => {
      auditEvents.push(evt);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    privacyScannerClient.resetMock();
    policyClient.resetMock();
    modelProviderClient.resetMock();
    securityAuditClient.resetMocks();
  });

  describe('Authentication & Idempotency Header Validation', () => {
    it('should reject unauthenticated request with 401', async () => {
      const res = await request(app)
        .post('/v1/ai-requests')
        .set('Idempotency-Key', 'test-key-1')
        .send(mockValidAiPayload);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(providerCalls).toBe(0);
    });

    it('should reject invalid token with 401', async () => {
      const res = await request(app)
        .post('/v1/ai-requests')
        .set('Authorization', 'Bearer invalid_token')
        .set('Idempotency-Key', 'test-key-1')
        .send(mockValidAiPayload);

      expect(res.status).toBe(401);
      expect(providerCalls).toBe(0);
    });

    it('should reject submission missing Idempotency-Key header with 400', async () => {
      const res = await request(app)
        .post('/v1/ai-requests')
        .set('Authorization', `Bearer ${validToken}`)
        .send(mockValidAiPayload);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(providerCalls).toBe(0);
    });
  });

  describe('Happy Path Request Submission & Retrieval', () => {
    it('should accept valid AI request with 202 Accepted and complete pipeline', async () => {
      const idempotencyKey = `idem-${Date.now()}`;

      const postRes = await request(app)
        .post('/v1/ai-requests')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(mockValidAiPayload);

      expect(postRes.status).toBe(202);
      expect(postRes.body.requestId).toMatch(/^req_/);
      expect(postRes.body.status).toBe('ACCEPTED');
      expect(postRes.body.traceId).toMatch(/^trace_/);
      expect(postRes.body.statusUrl).toBe(`/v1/ai-requests/${postRes.body.requestId}`);
      expect(providerCalls).toBe(1);

      // Verify request state in database via GET
      const getRes = await request(app)
        .get(`/v1/ai-requests/${postRes.body.requestId}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.id).toBe(postRes.body.requestId);
      expect(getRes.body.status).toBe('COMPLETED');
      expect(getRes.body.sanitizedResult).toContain('Zero trust means never trust');
      expect(getRes.body.completedAt).toBeDefined();
    });

    it('should return cached outcome on exact idempotency replay without re-invoking provider', async () => {
      const idempotencyKey = 'replay-key-1';

      // First submission
      const firstRes = await request(app)
        .post('/v1/ai-requests')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(mockValidAiPayload);

      expect(firstRes.status).toBe(202);
      expect(providerCalls).toBe(1);

      // Replay with exact same key and payload
      const replayRes = await request(app)
        .post('/v1/ai-requests')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(mockValidAiPayload);

      expect(replayRes.status).toBe(202);
      expect(replayRes.body.requestId).toBe(firstRes.body.requestId);
      expect(providerCalls).toBe(1); // Provider must NOT be called again
    });

    it('should return 409 Conflict if same idempotency key is reused with DIFFERENT payload', async () => {
      const idempotencyKey = 'conflict-key-1';

      await request(app)
        .post('/v1/ai-requests')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(mockValidAiPayload);

      // Submit with modified prompt
      const conflictRes = await request(app)
        .post('/v1/ai-requests')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          messages: [{ role: 'user', content: 'Different prompt entirely.' }]
        });

      expect(conflictRes.status).toBe(409);
      expect(conflictRes.body.error.code).toBe('CONFLICT');
    });
  });

  describe('Privacy Scanner Decision Enforcement', () => {
    it('SECURITY REQUIREMENT: BLOCK decision stops pipeline with zero provider calls', async () => {
      privacyScannerClient.setMockHandler(async () => ({
        action: 'BLOCK',
        findings: [{ type: 'SECRET_KEY', severity: 'HIGH', description: 'AWS Secret Key detected' }]
      }));

      const res = await request(app)
        .post('/v1/ai-requests')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Idempotency-Key', 'block-key-1')
        .send(mockValidAiPayload);

      expect(res.status).toBe(202);
      expect(providerCalls).toBe(0); // MUST be zero

      // Check persisted record
      const getRes = await request(app)
        .get(`/v1/ai-requests/${res.body.requestId}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.status).toBe('BLOCKED');
      expect(getRes.body.privacyAction).toBe('BLOCK');
      expect(getRes.body.errorCode).toBe('PRIVACY_POLICY_BLOCK');

      // Verify audit event was logged
      const blockEvent = auditEvents.find((e) => e.eventType === 'AI_REQUEST_BLOCKED_PRIVACY');
      expect(blockEvent).toBeDefined();
      expect(blockEvent.severity).toBe('WARN');
    });

    it('SECURITY REQUIREMENT: MASK decision passes sanitized messages to provider', async () => {
      let forwardedMessages = null;

      privacyScannerClient.setMockHandler(async () => ({
        action: 'MASK',
        sanitizedMessages: [
          { role: 'user', content: 'Hello [MASKED_NAME], your phone is [MASKED_PHONE].' }
        ]
      }));

      modelProviderClient.setMockHandler(async ({ messages }) => {
        forwardedMessages = messages;
        providerCalls += 1;
        return {
          model: 'gpt-4o',
          provider: 'openai',
          choices: [{ message: { role: 'assistant', content: 'Hello there.' } }]
        };
      });

      const res = await request(app)
        .post('/v1/ai-requests')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Idempotency-Key', 'mask-key-1')
        .send({
          messages: [{ role: 'user', content: 'Hello Alice, your phone is 555-0199.' }]
        });

      expect(res.status).toBe(202);
      expect(providerCalls).toBe(1);
      expect(forwardedMessages[0].content).toBe('Hello [MASKED_NAME], your phone is [MASKED_PHONE].');
    });

    it('SECURITY REQUIREMENT: REQUIRE_APPROVAL decision stops provider execution and sets WAITING_FOR_APPROVAL', async () => {
      privacyScannerClient.setMockHandler(async () => ({
        action: 'REQUIRE_APPROVAL',
        findings: [{ type: 'CONFIDENTIAL_MARKER', severity: 'MEDIUM', description: 'Internal document marker' }]
      }));

      const res = await request(app)
        .post('/v1/ai-requests')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Idempotency-Key', 'approval-key-1')
        .send(mockValidAiPayload);

      expect(res.status).toBe(202);
      expect(providerCalls).toBe(0);

      const getRes = await request(app)
        .get(`/v1/ai-requests/${res.body.requestId}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.status).toBe('WAITING_FOR_APPROVAL');
    });

    it('SECURITY REGRESSION: Privacy Scanner failure aborts safely with 503 and zero provider calls', async () => {
      privacyScannerClient.setMockHandler(async () => {
        const { ServiceUnavailableError } = require('../../src/utils/errors');
        throw new ServiceUnavailableError('Scanner connection timed out');
      });

      const res = await request(app)
        .post('/v1/ai-requests')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Idempotency-Key', 'fail-scanner-key')
        .send(mockValidAiPayload);

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
      expect(providerCalls).toBe(0);
    });
  });

  describe('Policy Service Governance Decision Enforcement', () => {
    it('SECURITY REQUIREMENT: Policy DENY halts model invocation with zero provider calls', async () => {
      policyClient.setMockHandler(async () => ({
        decision: 'DENY',
        violations: [{ rule: 'FINANCIAL_MODEL_RESTRICTION', reason: 'Unapproved model for financial data' }]
      }));

      const res = await request(app)
        .post('/v1/ai-requests')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Idempotency-Key', 'policy-deny-key')
        .send(mockValidAiPayload);

      expect(res.status).toBe(202);
      expect(providerCalls).toBe(0);

      const getRes = await request(app)
        .get(`/v1/ai-requests/${res.body.requestId}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.status).toBe('BLOCKED');
      expect(getRes.body.policyDecision).toBe('DENY');
      expect(getRes.body.errorMessage).toContain('Unapproved model for financial data');
    });

    it('SECURITY REGRESSION: Policy Service failure aborts safely with 503 and zero provider calls', async () => {
      policyClient.setMockHandler(async () => {
        const { ServiceUnavailableError } = require('../../src/utils/errors');
        throw new ServiceUnavailableError('Policy database unreachable');
      });

      const res = await request(app)
        .post('/v1/ai-requests')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Idempotency-Key', 'policy-fail-key')
        .send(mockValidAiPayload);

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
      expect(providerCalls).toBe(0);
    });
  });

  describe('Model Provider Failure Handling', () => {
    it('should map provider timeout to 504 and record failure', async () => {
      modelProviderClient.setMockHandler(async () => {
        const { GatewayTimeoutError } = require('../../src/utils/errors');
        throw new GatewayTimeoutError('Provider timeout after 15000ms');
      });

      const res = await request(app)
        .post('/v1/ai-requests')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Idempotency-Key', 'timeout-key-1')
        .send(mockValidAiPayload);

      expect(res.status).toBe(504);
      expect(res.body.error.code).toBe('GATEWAY_TIMEOUT');
    });
  });
});
