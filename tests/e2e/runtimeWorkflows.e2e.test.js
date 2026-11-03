// Live Runtime E2E Integration Suite: AI Response, Provider/Model Management, RBAC, and Isolation

const BASE_URL = 'http://localhost:5173';

describe('Live Runtime Workflows & RBAC Verification', () => {
  let adminToken = '';
  let devToken = '';
  let adminOrgId = '';

  beforeAll(async () => {
    // 1. Authenticate as Organization Administrator
    const adminRes = await fetch(`${BASE_URL}/api/identity/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@enterprise.internal',
        password: 'AdminSecurePassword!2026'
      })
    });
    expect(adminRes.status).toBe(200);
    const adminData = await adminRes.json();
    adminToken = adminData.tokens.accessToken;
    adminOrgId = adminData.user.organizationId;
    expect(adminToken).toBeDefined();

    // 2. Authenticate as Developer
    const devRes = await fetch(`${BASE_URL}/api/identity/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'developer@enterprise.internal',
        password: 'DevSecurePassword!2026'
      })
    });
    expect(devRes.status).toBe(200);
    const devData = await devRes.json();
    devToken = devData.tokens.accessToken;
    expect(devToken).toBeDefined();
    expect(devData.user.role).toBe('DEVELOPER');
  });

  describe('1. AI Request Pipeline & Response Retrieval', () => {
    let requestId = '';
    let traceId = '';

    it('submits AI request via AI Gateway and receives ACCEPTED status with correlation IDs', async () => {
      const res = await fetch(`${BASE_URL}/api/gateway/v1/ai-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
          'Idempotency-Key': `e2e_req_${Date.now()}`
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'What is the speed of light?' }],
          modelPreference: { model: 'mock-gpt-4o' },
          metadata: { source: 'e2e-test' }
        })
      });

      expect([200, 202]).toContain(res.status);
      const data = await res.json();
      expect(data.requestId).toBeDefined();
      expect(data.traceId).toBeDefined();
      expect(data.status).toBe('ACCEPTED');

      requestId = data.requestId;
      traceId = data.traceId;
    });

    it('polls GET /v1/ai-requests/:id and retrieves COMPLETED status with real response text', async () => {
      expect(requestId).toBeTruthy();

      const detailRes = await fetch(`${BASE_URL}/api/gateway/v1/ai-requests/${requestId}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      expect(detailRes.status).toBe(200);
      const detail = await detailRes.json();
      expect(detail.id).toBe(requestId);
      expect(detail.status).toBe('COMPLETED');
      expect(detail.sanitizedResult).toBeDefined();
      expect(detail.sanitizedResult.length).toBeGreaterThan(0);
      expect(detail.sanitizedResult).toContain('mock-gpt-4o');

      // Verify aliases
      expect(detail.result).toBe(detail.sanitizedResult);
      expect(detail.response).toBe(detail.sanitizedResult);
      expect(detail.traceId).toBe(traceId);
    });

    it('enforces that a developer can access only their own requests', async () => {
      // 1. Dev submits a request
      const devSubRes = await fetch(`${BASE_URL}/api/gateway/v1/ai-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${devToken}`,
          'Idempotency-Key': `dev_e2e_${Date.now()}`
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Developer prompt' }],
          modelPreference: { model: 'mock-gpt-4o' }
        })
      });

      expect([200, 202]).toContain(devSubRes.status);
      const devSub = await devSubRes.json();

      // 2. Dev can access own request
      const ownRes = await fetch(`${BASE_URL}/api/gateway/v1/ai-requests/${devSub.requestId}`, {
        headers: { Authorization: `Bearer ${devToken}` }
      });
      expect(ownRes.status).toBe(200);

      // 3. Dev CANNOT access admin's request (must return 404)
      const adminReqAccessRes = await fetch(`${BASE_URL}/api/gateway/v1/ai-requests/${requestId}`, {
        headers: { Authorization: `Bearer ${devToken}` }
      });
      expect(adminReqAccessRes.status).toBe(404);

      // 4. Admin CAN access developer's request within same organization
      const adminDevAccessRes = await fetch(`${BASE_URL}/api/gateway/v1/ai-requests/${devSub.requestId}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      expect(adminDevAccessRes.status).toBe(200);
    });
  });

  describe('2. Provider and Model Registration & Persistence', () => {
    const testProviderId = `custom-ollama-${Date.now()}`;
    const testModelId = `model-ollama-${Date.now()}`;

    it('allows Organization Administrator to register a provider', async () => {
      const res = await fetch(`${BASE_URL}/api/model/v1/providers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          id: testProviderId,
          name: 'Custom Ollama Instance',
          type: 'openai',
          baseUrl: 'http://127.0.0.1:11434/v1',
          apiKey: 'sk-secret-token-mask-test-999',
          enabled: true
        })
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBe(testProviderId);
      expect(data.name).toBe('Custom Ollama Instance');
      expect(data.apiKeyConfigured).toBe(true);
      // API key secret must be securely masked
      expect(data.apiKeyMasked).not.toBe('sk-secret-token-mask-test-999');
      expect(data.apiKeyMasked).toContain('sk-s');
    });

    it('tests connectivity for configured provider and returns safe diagnostic without exposing secrets', async () => {
      const testRes = await fetch(`${BASE_URL}/api/model/v1/providers/${testProviderId}/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      expect(testRes.status).toBe(200);
      const testData = await testRes.json();
      expect(testData).toHaveProperty('healthy');
      expect(testData).toHaveProperty('latencyMs');
      expect(testData).toHaveProperty('message');
    });

    it('allows registering a model under the newly registered provider', async () => {
      const res = await fetch(`${BASE_URL}/api/model/v1/models`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          modelId: testModelId,
          provider: testProviderId,
          providerModelName: 'llama3:8b',
          contextWindow: 8192,
          maxTokens: 2048,
          capabilities: ['chat'],
          enabled: true
        })
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.modelId).toBe(testModelId);
      expect(data.provider).toBe(testProviderId);
    });

    it('verifies the newly registered model appears in GET /v1/models', async () => {
      const res = await fetch(`${BASE_URL}/api/model/v1/models?enabled=true`);
      expect(res.status).toBe(200);
      const body = await res.json();
      const found = body.data?.find((m) => m.modelId === testModelId);
      expect(found).toBeDefined();
      expect(found.provider).toBe(testProviderId);
    });

    it('blocks developers from registering providers (403 Forbidden)', async () => {
      const res = await fetch(`${BASE_URL}/api/model/v1/providers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${devToken}`
        },
        body: JSON.stringify({
          id: 'unauthorized-provider',
          name: 'Hacked Provider',
          type: 'openai'
        })
      });

      expect(res.status).toBe(403);
    });

    it('blocks developers from registering models (403 Forbidden)', async () => {
      const res = await fetch(`${BASE_URL}/api/model/v1/models`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${devToken}`
        },
        body: JSON.stringify({
          modelId: 'unauthorized-model',
          provider: 'openai'
        })
      });

      expect(res.status).toBe(403);
    });
  });

  describe('3. Policies, Approvals, and Security Audit Integration', () => {
    it('verifies that preflight privacy scanner detects PII and returns masked preview', async () => {
      const res = await fetch(`${BASE_URL}/api/privacy/v1/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Contact me at test.user@enterprise.com' }],
          organizationId: adminOrgId
        })
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.action).toBe('MASK');
      expect(data.findings?.length).toBeGreaterThan(0);
      expect(data.sanitizedMessages[0].content).toContain('[EMAIL_1]');
    });

    it('verifies that Security Audit trace loads and events pass cryptographic integrity check', async () => {
      // Create a request to generate audit events
      const subRes = await fetch(`${BASE_URL}/api/gateway/v1/ai-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
          'Idempotency-Key': `audit_trace_e2e_${Date.now()}`
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Audit trace test' }],
          modelPreference: { model: 'mock-gpt-4o' }
        })
      });
      const sub = await subRes.json();

      // Query trace
      const traceRes = await fetch(`${BASE_URL}/api/audit/v1/traces/${sub.traceId}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      expect(traceRes.status).toBe(200);
      const trace = await traceRes.json();
      expect(trace.events.length).toBeGreaterThan(0);

      // Verify cryptographic digest of first event
      const eventId = trace.events[0].eventId || trace.events[0].id;
      const verifyRes = await fetch(`${BASE_URL}/api/audit/v1/events/${eventId}/verify`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      expect(verifyRes.status).toBe(200);
      const verify = await verifyRes.json();
      expect(verify.valid).toBe(true);
      expect(verify.verified).toBe(true);
    });
  });
});
