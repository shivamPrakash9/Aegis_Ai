// Unit Tests: Provider Registry and Model Allowlist

const { ProviderRegistryService } = require('../../src/services/providerRegistry.service');
const { ModelNotFoundError, ForbiddenError } = require('../../src/utils/errors');

describe('Provider Registry & Model Allowlist', () => {
  let registry;

  beforeEach(() => {
    registry = new ProviderRegistryService();
  });

  test('resolves registered model and provider correctly', () => {
    const { modelConfig, provider } = registry.resolveModel('mock-gpt-4o');

    expect(modelConfig).toBeDefined();
    expect(modelConfig.modelId).toBe('mock-gpt-4o');
    expect(modelConfig.enabled).toBe(true);
    expect(provider).toBeDefined();
    expect(provider.id).toBe('mock');
  });

  test('case-insensitively resolves model names', () => {
    const { modelConfig } = registry.resolveModel('MOCK-GPT-4O');
    expect(modelConfig.modelId).toBe('mock-gpt-4o');
  });

  test('rejects unknown model with ModelNotFoundError (404)', () => {
    expect(() => registry.resolveModel('unregistered-arbitrary-model')).toThrow(ModelNotFoundError);
  });

  test('rejects disabled model with ForbiddenError (403)', () => {
    registry.setModelEnabled('mock-gpt-4o', false);

    expect(() => registry.resolveModel('mock-gpt-4o')).toThrow(ForbiddenError);
  });

  test('enforces allowedProviders routing constraint', () => {
    // Model is configured with provider 'mock', but caller restricts to ['openai']
    expect(() =>
      registry.resolveModel('mock-gpt-4o', {
        allowedProviders: ['openai']
      })
    ).toThrow(ForbiddenError);

    // Matching allowedProviders passes
    const result = registry.resolveModel('mock-gpt-4o', {
      allowedProviders: ['mock', 'openai']
    });
    expect(result.modelConfig).toBeDefined();
  });

  test('lists all models and filters by enabled state', () => {
    const all = registry.listModels();
    expect(all.length).toBeGreaterThan(3);

    registry.setModelEnabled('mock-claude-3-5', false);

    const enabledOnly = registry.listModels({ enabledOnly: true });
    expect(enabledOnly.some((m) => m.modelId === 'mock-claude-3-5')).toBe(false);
  });

  test('throws ServiceUnavailableError for unconfigured real provider instead of silently using mock', () => {
    const { ServiceUnavailableError } = require('../../src/utils/errors');
    // Ensure openai provider is not configured
    const openai = registry.getProvider('openai');
    if (openai && !openai.isConfigured()) {
      expect(() => registry.resolveModel('gpt-4o')).toThrow(ServiceUnavailableError);
    }
  });

  test('explicit mock model resolves to mock provider', () => {
    const { modelConfig, provider } = registry.resolveModel('mock-gpt-4o');
    expect(modelConfig.provider).toBe('mock');
    expect(provider.id).toBe('mock');
  });
});
