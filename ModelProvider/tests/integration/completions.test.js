// Integration Tests: Chat Completions API (POST /v1/chat/completions)

const request = require('supertest');
const { app } = require('../../src/app');
const { usageRepository } = require('../../src/repositories/usage.repository');
const { providerRegistry } = require('../../src/services/providerRegistry.service');
const { testOrgId, sampleRequests } = require('../fixtures/syntheticData');

describe('Chat Completions API (POST /v1/chat/completions)', () => {
  beforeEach(() => {
    usageRepository.setForceInMemory(true);
    usageRepository.clear();
    providerRegistry.resetCatalog();
  });

  test('successfully processes Gateway format completion request with mock model', async () => {
    const res = await request(app)
      .post('/v1/chat/completions')
      .set('X-Correlation-Id', 'test-corr-abc')
      .set('X-Trace-Id', 'test-trace-xyz')
      .send(sampleRequests.gatewayFormat);

    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
    expect(res.body.model).toBe('mock-gpt-4o');
    expect(res.body.provider).toBe('mock');
    expect(res.body.choices).toHaveLength(1);
    expect(res.body.choices[0].message.role).toBe('assistant');
    expect(res.body.choices[0].message.content).toBeDefined();

    // Verify usage conforms to both camelCase and snake_case standards
    expect(res.body.usage).toBeDefined();
    expect(res.body.usage.promptTokens).toBeGreaterThan(0);
    expect(res.body.usage.completionTokens).toBeGreaterThan(0);
    expect(res.body.usage.totalTokens).toBeGreaterThan(0);
    expect(res.body.usage.total_tokens).toBe(res.body.usage.totalTokens);

    // Verify headers preserved
    expect(res.headers['x-correlation-id']).toBe('test-corr-abc');
    expect(res.headers['x-trace-id']).toBe('test-trace-xyz');

    // Verify usage record was saved in repository
    const stats = await usageRepository.getUsageSummary(testOrgId);
    expect(stats.total).toBe(1);
    expect(stats.items[0].model).toBe('mock-gpt-4o');
    expect(stats.items[0].status).toBe('COMPLETED');
  });

  test('successfully processes standard OpenAI format completion request', async () => {
    const res = await request(app)
      .post('/v1/chat/completions')
      .send(sampleRequests.openaiStandardFormat);

    expect(res.status).toBe(200);
    expect(res.body.choices).toHaveLength(1);
    expect(res.body.choices[0].message.content).toBeDefined();
  });

  test('rejects request with unknown/unapproved model with 404 Model Not Found', async () => {
    const payload = {
      ...sampleRequests.gatewayFormat,
      modelPreference: { model: 'unapproved-rogue-model-v9' }
    };

    const res = await request(app)
      .post('/v1/chat/completions')
      .send(payload);

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('MODEL_NOT_FOUND');
  });

  test('rejects request with disabled model with 403 Forbidden', async () => {
    providerRegistry.setModelEnabled('mock-gpt-4o', false);

    const res = await request(app)
      .post('/v1/chat/completions')
      .send(sampleRequests.gatewayFormat);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toMatch(/disabled/i);
  });

  test('fails closed with 400 Bad Request on empty or missing messages array', async () => {
    const invalidPayload = {
      organizationId: testOrgId,
      messages: []
    };

    const res = await request(app)
      .post('/v1/chat/completions')
      .send(invalidPayload);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  test('fails closed with 400 Bad Request when organizationId is missing', async () => {
    const invalidPayload = {
      messages: [{ role: 'user', content: 'Hello' }]
    };

    const res = await request(app)
      .post('/v1/chat/completions')
      .send(invalidPayload);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});
