// Integration Tests: AI Gateway ModelProviderClient Contract Compatibility

const http = require('http');
const { app } = require('../../src/app');
const { ModelProviderClient } = require('../../../AIGateway/src/clients/modelProviderClient');
const { usageRepository } = require('../../src/repositories/usage.repository');
const { providerRegistry } = require('../../src/services/providerRegistry.service');
const { testOrgId } = require('../fixtures/syntheticData');

describe('AI Gateway ModelProviderClient Contract Compatibility', () => {
  let server;
  let client;

  beforeAll((done) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      client = new ModelProviderClient(`http://127.0.0.1:${port}`);
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
    usageRepository.setForceInMemory(true);
    usageRepository.clear();
    providerRegistry.resetCatalog();
  });

  test('ModelProviderClient invokes model and returns Gateway-compatible response', async () => {
    const result = await client.invokeModel({
      messages: [
        { role: 'user', content: 'Explain public key cryptography.' }
      ],
      modelPreference: {
        model: 'mock-gpt-4o',
        provider: 'mock'
      },
      routingConstraints: {
        allowedProviders: ['mock']
      },
      organizationId: testOrgId,
      traceId: 'gateway-trace-1001',
      correlationId: 'gateway-corr-1001'
    });

    expect(result).toBeDefined();
    expect(result.model).toBe('mock-gpt-4o');
    expect(result.provider).toBe('mock');
    expect(Array.isArray(result.choices)).toBe(true);
    expect(result.choices.length).toBeGreaterThan(0);
    expect(result.choices[0].message).toBeDefined();
    expect(result.choices[0].message.role).toBe('assistant');
    expect(typeof result.choices[0].message.content).toBe('string');
    expect(result.choices[0].message.content.length).toBeGreaterThan(0);

    // Verify token usage fields consumed by Gateway
    expect(result.usage).toBeDefined();
    expect(result.usage.totalTokens).toBeGreaterThan(0);
  });

  test('ModelProviderClient handles model fallback or default model selection cleanly', async () => {
    // When modelPreference does not specify model, service uses default model (e.g. gpt-4o-mini mapped to mock in test)
    const result = await client.invokeModel({
      messages: [
        { role: 'user', content: 'Summarize the memo.' }
      ],
      modelPreference: {
        model: 'test-model'
      },
      organizationId: testOrgId,
      traceId: 'gateway-trace-1002',
      correlationId: 'gateway-corr-1002'
    });

    expect(result).toBeDefined();
    expect(result.model).toBe('test-model');
    expect(result.choices[0].message.content).toBeDefined();
  });

  test('ModelProviderClient throws BadGatewayError on unknown model rejection', async () => {
    await expect(
      client.invokeModel({
        messages: [{ role: 'user', content: 'Hello' }],
        modelPreference: { model: 'nonexistent-model-xyz' },
        organizationId: testOrgId,
        traceId: 'gateway-trace-1003',
        correlationId: 'gateway-corr-1003'
      })
    ).rejects.toThrow();
  });
});
