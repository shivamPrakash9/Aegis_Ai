// Provider Registry and Model Allowlist Service

const { mockProvider } = require('../providers/mock.provider');
const { openAiCompatibleProvider } = require('../providers/openaiCompatible.provider');
const { anthropicProvider } = require('../providers/anthropic.provider');
const { ModelNotFoundError, ForbiddenError, ServiceUnavailableError } = require('../utils/errors');
const { env } = require('../config/env');

const DEFAULT_CATALOG = [
  {
    modelId: 'gpt-4o',
    provider: env.isTest ? 'openai' : (env.openaiApiKey ? 'openai' : (env.groqApiKey ? 'groq' : 'openai')),
    providerModelName: env.openaiApiKey ? 'gpt-4o-2024-08-06' : (env.groqApiKey ? 'openai/gpt-oss-120b' : 'gpt-4o-2024-08-06'),
    enabled: true,
    isDefault: true,
    maxTokens: 4096,
    contextWindow: 128000,
    defaultTemperature: 0.7,
    capabilities: ['chat', 'reasoning'],
    description: 'High-intelligence flagship model for complex multimodal reasoning'
  },
  {
    modelId: 'gpt-4o-mini',
    provider: env.isTest ? 'openai' : (env.openaiApiKey ? 'openai' : (env.groqApiKey ? 'groq' : 'openai')),
    providerModelName: env.openaiApiKey ? 'gpt-4o-mini-2024-07-18' : (env.groqApiKey ? 'openai/gpt-oss-20b' : 'gpt-4o-mini-2024-07-18'),
    enabled: true,
    isDefault: false,
    maxTokens: 4096,
    contextWindow: 128000,
    defaultTemperature: 0.7,
    capabilities: ['chat'],
    description: 'Fast, cost-efficient frontier model for everyday tasks'
  },
  {
    modelId: 'gpt-oss-120b',
    provider: 'groq',
    providerModelName: 'openai/gpt-oss-120b',
    enabled: true,
    isDefault: false,
    maxTokens: 4096,
    contextWindow: 128000,
    defaultTemperature: 0.7,
    capabilities: ['chat', 'reasoning'],
    description: 'OpenAI 120B reasoning model hosted on Groq'
  },
  {
    modelId: 'gpt-oss-20b',
    provider: 'groq',
    providerModelName: 'openai/gpt-oss-20b',
    enabled: true,
    isDefault: false,
    maxTokens: 4096,
    contextWindow: 128000,
    defaultTemperature: 0.7,
    capabilities: ['chat'],
    description: 'OpenAI 20B lightweight model hosted on Groq'
  },
  {
    modelId: 'qwen-27b',
    provider: 'groq',
    providerModelName: 'qwen/qwen3.8-27b',
    enabled: true,
    isDefault: false,
    maxTokens: 4096,
    contextWindow: 128000,
    defaultTemperature: 0.7,
    capabilities: ['chat', 'coding'],
    description: 'Qwen 27B model on Groq'
  },
  {
    modelId: 'claude-3-5-sonnet',
    provider: 'anthropic',
    providerModelName: 'claude-3-5-sonnet-20240620',
    enabled: true,
    isDefault: false,
    maxTokens: 4096,
    contextWindow: 200000,
    defaultTemperature: 0.7,
    capabilities: ['chat', 'coding'],
    description: 'Most intelligent Claude model for complex reasoning and software engineering'
  },
  {
    modelId: 'claude-3-haiku',
    provider: 'anthropic',
    providerModelName: 'claude-3-haiku-20240307',
    enabled: true,
    isDefault: false,
    maxTokens: 4096,
    contextWindow: 200000,
    defaultTemperature: 0.7,
    capabilities: ['chat'],
    description: 'Fast and compact model for near-instant responsiveness'
  },
  {
    modelId: 'mock-gpt-4o',
    provider: 'mock',
    providerModelName: 'mock-gpt-4o',
    enabled: true,
    isDefault: false,
    maxTokens: 4096,
    contextWindow: 128000,
    defaultTemperature: 0.7,
    capabilities: ['chat'],
    description: 'Deterministic test mock for GPT-4o'
  },
  {
    modelId: 'mock-claude-3-5',
    provider: 'mock',
    providerModelName: 'mock-claude-3-5',
    enabled: true,
    isDefault: false,
    maxTokens: 4096,
    contextWindow: 200000,
    defaultTemperature: 0.7,
    capabilities: ['chat'],
    description: 'Deterministic test mock for Claude 3.5'
  },
  {
    modelId: 'test-model',
    provider: 'mock',
    providerModelName: 'test-model',
    enabled: true,
    isDefault: false,
    maxTokens: 2048,
    contextWindow: 32000,
    defaultTemperature: 0.5,
    capabilities: ['chat'],
    description: 'Generic test model for automated tests'
  }
];

class ProviderRegistryService {
  constructor() {
    this.providers = new Map();
    this.modelCatalog = new Map();

    // Register built-in provider adapters
    this.registerProvider(mockProvider);
    this.registerProvider(openAiCompatibleProvider);
    this.registerProvider(anthropicProvider);

    if (env.groqApiKey) {
      this.registerProvider(
        new openAiCompatibleProvider.constructor({
          id: 'groq',
          name: 'Groq Cloud',
          apiKey: env.groqApiKey,
          baseUrl: env.groqBaseUrl || 'https://api.groq.com/openai/v1'
        })
      );
    }

    // Initialize default model catalog
    this.resetCatalog();
  }

  registerProvider(provider) {
    this.providers.set(provider.id.toLowerCase(), provider);
  }

  registerDynamicProvider({ id, name, type = 'openai', baseUrl = null, apiKey = null }) {
    const key = String(id).toLowerCase().trim();
    let adapter;
    const providerType = String(type).toLowerCase().trim();

    if (providerType === 'anthropic') {
      adapter = new anthropicProvider.constructor({
        id: key,
        name: name || key,
        apiKey: apiKey || '',
        baseUrl: baseUrl || 'https://api.anthropic.com'
      });
    } else if (providerType === 'mock') {
      adapter = mockProvider;
    } else {
      // Default to OpenAI-compatible
      adapter = new openAiCompatibleProvider.constructor({
        id: key,
        name: name || key,
        apiKey: apiKey || '',
        baseUrl: baseUrl || 'https://api.openai.com/v1'
      });
    }

    this.providers.set(key, adapter);
    return adapter;
  }

  getProvider(providerId) {
    const key = String(providerId || '').toLowerCase().trim();
    return this.providers.get(key) || null;
  }

  resetCatalog() {
    this.modelCatalog.clear();
    for (const item of DEFAULT_CATALOG) {
      this.modelCatalog.set(item.modelId.toLowerCase(), { ...item });
    }
  }

  registerModel(modelConfig) {
    if (!modelConfig || !modelConfig.modelId || !modelConfig.provider) {
      throw new Error('Invalid model configuration: modelId and provider are required.');
    }
    const key = modelConfig.modelId.toLowerCase();
    this.modelCatalog.set(key, {
      ...modelConfig,
      enabled: modelConfig.enabled !== false
    });
  }

  setModelEnabled(modelId, enabled) {
    const key = String(modelId || '').toLowerCase();
    const existing = this.modelCatalog.get(key);
    if (!existing) {
      throw new ModelNotFoundError(`Model '${modelId}' not found in registry.`);
    }
    existing.enabled = Boolean(enabled);
    return existing;
  }

  listModels({ enabledOnly = false } = {}) {
    let list = Array.from(this.modelCatalog.values());
    if (enabledOnly) {
      list = list.filter((m) => m.enabled);
    }
    return list;
  }

  getModel(modelId) {
    const key = String(modelId || '').toLowerCase();
    return this.modelCatalog.get(key) || null;
  }

  /**
   * Resolves requested model and selects appropriate provider adapter.
   *
   * @param {string} requestedModel
   * @param {object} [options]
   * @param {string} [options.preferredProvider]
   * @param {Array<string>} [options.allowedProviders]
   * @returns {{ modelConfig: object, provider: BaseProvider }}
   */
  resolveModel(requestedModel, { preferredProvider, allowedProviders } = {}) {
    const modelKey = (requestedModel || env.defaultModel).toLowerCase();
    const modelConfig = this.modelCatalog.get(modelKey);

    if (!modelConfig) {
      throw new ModelNotFoundError(
        `Model '${requestedModel}' is not supported or recognized by the governance gateway.`
      );
    }

    if (!modelConfig.enabled) {
      throw new ForbiddenError(
        `Model '${requestedModel}' is currently disabled by enterprise policy.`
      );
    }

    // Check routing constraints
    if (Array.isArray(allowedProviders) && allowedProviders.length > 0) {
      if (!allowedProviders.includes(modelConfig.provider)) {
        throw new ForbiddenError(
          `Provider '${modelConfig.provider}' for model '${requestedModel}' is restricted by routing constraints.`
        );
      }
    }

    let targetProviderId = preferredProvider || modelConfig.provider;
    let provider = this.getProvider(targetProviderId);

    // If requested provider is not found or not configured, fallback to mock if in test mode
    if (!provider) {
      throw new ServiceUnavailableError(`Provider '${targetProviderId}' is not registered.`);
    }

    // Only mock provider is allowed to run unauthenticated
    if (!provider.isConfigured()) {
      if (provider.id === 'mock' || targetProviderId === 'mock') {
        // Mock provider is explicitly requested
        provider = this.getProvider('mock');
      } else {
        throw new ServiceUnavailableError(
          `Provider '${provider.id}' for model '${requestedModel}' is not configured with valid API credentials. Please configure an API key in Models & Providers or set ${provider.id.toUpperCase()}_API_KEY.`
        );
      }
    }

    return {
      modelConfig,
      provider
    };
  }
}

module.exports = {
  ProviderRegistryService,
  providerRegistry: new ProviderRegistryService()
};
