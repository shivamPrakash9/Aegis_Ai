// Integration Tests: Models Catalog Administration and Usage Queries

const request = require('supertest');
const { app } = require('../../src/app');
const { usageRepository } = require('../../src/repositories/usage.repository');
const { modelConfigRepository } = require('../../src/repositories/modelConfig.repository');
const { providerRegistry } = require('../../src/services/providerRegistry.service');
const { testOrgId, generateTestToken } = require('../fixtures/syntheticData');

describe('Models Catalog & Usage Administration API', () => {
  const adminToken = generateTestToken({ organizationId: testOrgId, role: 'MODEL_ADMIN' });
  const memberToken = generateTestToken({ organizationId: testOrgId, role: 'MEMBER' });

  beforeEach(() => {
    usageRepository.setForceInMemory(true);
    modelConfigRepository.setForceInMemory(true);
    usageRepository.clear();
    modelConfigRepository.clear();
    providerRegistry.resetCatalog();
  });

  test('GET /v1/models lists supported models in OpenAI compatible structure', async () => {
    const res = await request(app).get('/v1/models');

    expect(res.status).toBe(200);
    expect(res.body.object).toBe('list');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('GET /v1/models/:id retrieves details of a specific model', async () => {
    const res = await request(app).get('/v1/models/mock-gpt-4o');

    expect(res.status).toBe(200);
    expect(res.body.modelId).toBe('mock-gpt-4o');
    expect(res.body.provider).toBe('mock');
  });

  test('POST /v1/models registers a new model when caller is authorized admin', async () => {
    const newModel = {
      modelId: 'custom-enterprise-llama',
      provider: 'mock',
      providerModelName: 'llama-3-70b-instruct',
      enabled: true,
      maxTokens: 4096,
      contextWindow: 64000,
      description: 'Self-hosted Llama 3 model'
    };

    const res = await request(app)
      .post('/v1/models')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(newModel);

    expect(res.status).toBe(201);
    expect(res.body.modelId).toBe('custom-enterprise-llama');

    // Verify it is now resolvable in the registry
    const resolved = providerRegistry.getModel('custom-enterprise-llama');
    expect(resolved).toBeDefined();
    expect(resolved.provider).toBe('mock');
  });

  test('POST /v1/models rejects registration from unprivileged member (403 Forbidden)', async () => {
    const newModel = {
      modelId: 'unauthorized-model',
      provider: 'mock'
    };

    const res = await request(app)
      .post('/v1/models')
      .set('Authorization', `Bearer ${memberToken}`)
      .send(newModel);

    expect(res.status).toBe(403);
  });

  test('POST /v1/models/:id/disable and /enable toggles availability', async () => {
    // Disable
    const disRes = await request(app)
      .post('/v1/models/mock-gpt-4o/disable')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(disRes.status).toBe(200);
    expect(disRes.body.enabled).toBe(false);

    // Enable
    const enRes = await request(app)
      .post('/v1/models/mock-gpt-4o/enable')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(enRes.status).toBe(200);
    expect(enRes.body.enabled).toBe(true);
  });

  test('GET /v1/usage returns aggregated operational token telemetry', async () => {
    await usageRepository.recordUsage({
      organizationId: testOrgId,
      model: 'mock-gpt-4o',
      provider: 'mock',
      promptTokens: 50,
      completionTokens: 25,
      totalTokens: 75,
      latencyMs: 120,
      status: 'COMPLETED'
    });

    const res = await request(app)
      .get(`/v1/usage?organizationId=${testOrgId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].totalTokens).toBe(75);
  });
});
