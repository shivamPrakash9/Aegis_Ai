// Model Catalog & Usage Management Service

const { providerRegistry } = require('./providerRegistry.service');
const { modelConfigRepository } = require('../repositories/modelConfig.repository');
const { providerConfigRepository } = require('../repositories/providerConfig.repository');
const { usageRepository } = require('../repositories/usage.repository');
const { BadRequestError, NotFoundError } = require('../utils/errors');
const { safeFetch } = require('../utils/httpSecurity');

class ModelManagementService {
  constructor({
    registry = providerRegistry,
    configRepo = modelConfigRepository,
    providerRepo = providerConfigRepository,
    usageRepo = usageRepository
  } = {}) {
    this.registry = registry;
    this.configRepo = configRepo;
    this.providerRepo = providerRepo;
    this.usageRepo = usageRepo;
  }

  /**
   * Synchronizes database records into the in-memory registry.
   */
  async _syncWithDatabase() {
    try {
      // Sync providers from database
      const dbProviders = await this.providerRepo.listAll();
      for (const p of dbProviders) {
        if (p.id !== 'mock') {
          const fullProvider = await this.providerRepo.findByProviderId(p.id, true);
          if (fullProvider && fullProvider.apiKey) {
            this.registry.registerDynamicProvider(fullProvider);
          }
        }
      }

      // Sync model configs from database
      const dbModels = await this.configRepo.listAll();
      for (const m of dbModels) {
        let caps = m.capabilities;
        if (typeof caps === 'string') {
          try {
            caps = JSON.parse(caps);
          } catch {
            caps = ['chat'];
          }
        }
        this.registry.registerModel({
          ...m,
          capabilities: Array.isArray(caps) ? caps : ['chat']
        });
      }
    } catch {
      // Non-fatal if DB sync fails
    }
  }

  async listModels({ enabledOnly = false } = {}) {
    await this._syncWithDatabase();
    return this.registry.listModels({ enabledOnly });
  }

  async getModel(modelId) {
    await this._syncWithDatabase();
    const model = this.registry.getModel(modelId);
    if (!model) {
      throw new NotFoundError(`Model '${modelId}' not found.`);
    }
    return model;
  }

  async registerModel(data) {
    if (!data.modelId || typeof data.modelId !== 'string') {
      throw new BadRequestError("Field 'modelId' is required.");
    }
    if (!data.provider || typeof data.provider !== 'string') {
      throw new BadRequestError("Field 'provider' is required.");
    }

    const providerKey = data.provider.toLowerCase().trim();
    const existingProvider = await this.providerRepo.findByProviderId(providerKey);
    if (!existingProvider && !this.registry.getProvider(providerKey)) {
      throw new BadRequestError(`Provider '${data.provider}' is not registered. Please register the provider first.`);
    }

    if (existingProvider && !existingProvider.enabled) {
      throw new BadRequestError(`Provider '${data.provider}' is currently disabled. Please enable it before assigning models.`);
    }

    const saved = await this.configRepo.saveModelConfig(data);
    this.registry.registerModel({
      ...data,
      capabilities: Array.isArray(data.capabilities) ? data.capabilities : ['chat']
    });

    return saved;
  }

  async updateModel(modelId, data) {
    const updated = await this.configRepo.updateModelConfig(modelId, data);
    let caps = updated.capabilities;
    if (typeof caps === 'string') {
      try {
        caps = JSON.parse(caps);
      } catch {
        caps = ['chat'];
      }
    }

    this.registry.registerModel({
      ...updated,
      capabilities: Array.isArray(caps) ? caps : ['chat']
    });

    return updated;
  }

  async deleteModel(modelId) {
    const result = await this.configRepo.deleteModelConfig(modelId);
    this.registry.modelCatalog.delete(String(modelId).toLowerCase());
    return result;
  }

  async setModelStatus(modelId, enabled) {
    const updated = this.registry.setModelEnabled(modelId, enabled);
    await this.configRepo.saveModelConfig(updated).catch(() => {});
    return updated;
  }

  // --- Provider Management Methods ---

  async listProviders({ enabledOnly = false } = {}) {
    await this._syncWithDatabase();
    return this.providerRepo.listAll({ enabledOnly });
  }

  async getProvider(providerId) {
    await this._syncWithDatabase();
    const provider = await this.providerRepo.findByProviderId(providerId);
    if (!provider) {
      throw new NotFoundError(`Provider '${providerId}' not found.`);
    }
    return provider;
  }

  async registerProvider(data) {
    if (!data.id || typeof data.id !== 'string') {
      throw new BadRequestError("Field 'id' is required.");
    }
    if (!data.name || typeof data.name !== 'string') {
      throw new BadRequestError("Field 'name' is required.");
    }
    const validTypes = ['openai', 'anthropic', 'gemini', 'mock', 'custom'];
    const pType = String(data.type || 'openai').toLowerCase().trim();
    if (!validTypes.includes(pType)) {
      throw new BadRequestError(`Field 'type' must be one of: ${validTypes.join(', ')}.`);
    }

    if (data.baseUrl) {
      try {
        const u = new URL(data.baseUrl);
        if (!['http:', 'https:'].includes(u.protocol)) {
          throw new Error('Must use http or https protocol');
        }
      } catch (e) {
        throw new BadRequestError(`Invalid 'baseUrl': ${e.message}`);
      }
    }

    const saved = await this.providerRepo.saveProviderConfig({
      id: data.id,
      name: data.name,
      type: pType,
      baseUrl: data.baseUrl,
      apiKey: data.apiKey,
      description: data.description,
      organizationId: data.organizationId,
      enabled: data.enabled !== false,
      isHealthy: true
    });

    // Register adapter in in-memory registry
    this.registry.registerDynamicProvider({
      id: data.id,
      name: data.name,
      type: pType,
      baseUrl: data.baseUrl,
      apiKey: data.apiKey
    });

    return saved;
  }

  async updateProvider(providerId, data) {
    if (data.baseUrl) {
      try {
        const u = new URL(data.baseUrl);
        if (!['http:', 'https:'].includes(u.protocol)) {
          throw new Error('Must use http or https protocol');
        }
      } catch (e) {
        throw new BadRequestError(`Invalid 'baseUrl': ${e.message}`);
      }
    }

    if (data.type) {
      const validTypes = ['openai', 'anthropic', 'gemini', 'mock', 'custom'];
      const pType = String(data.type).toLowerCase().trim();
      if (!validTypes.includes(pType)) {
        throw new BadRequestError(`Field 'type' must be one of: ${validTypes.join(', ')}.`);
      }
      data.type = pType;
    }

    const updated = await this.providerRepo.updateProviderConfig(providerId, data);

    // Refresh provider in in-memory registry with decrypted key
    const fullProvider = await this.providerRepo.findByProviderId(providerId, true);
    if (fullProvider) {
      this.registry.registerDynamicProvider(fullProvider);
    }

    return updated;
  }

  async deleteProvider(providerId) {
    const result = await this.providerRepo.deleteProvider(providerId);
    this.registry.providers.delete(String(providerId).toLowerCase());
    return result;
  }

  async setProviderStatus(providerId, enabled) {
    const updated = await this.providerRepo.setProviderStatus(providerId, enabled);
    if (!updated) {
      throw new NotFoundError(`Provider '${providerId}' not found.`);
    }
    return updated;
  }

  async testProviderConnection(providerId) {
    const provider = await this.providerRepo.findByProviderId(providerId, true);
    if (!provider) {
      throw new NotFoundError(`Provider '${providerId}' not found.`);
    }

    const startTime = Date.now();

    // Mock provider
    if (provider.type === 'mock' || provider.id === 'mock') {
      await this.providerRepo.setProviderHealth(providerId, true);
      return {
        healthy: true,
        latencyMs: 1,
        message: 'Mock provider loopback verified successfully.',
        timestamp: new Date().toISOString()
      };
    }

    // Google Gemini
    if (provider.type === 'gemini' || provider.id === 'gemini') {
      const { GeminiProvider } = require('../providers/gemini.provider');
      const adapter = new GeminiProvider({
        id: provider.id,
        name: provider.name,
        apiKey: provider.apiKey,
        baseUrl: provider.baseUrl || 'https://generativelanguage.googleapis.com/v1beta'
      });

      const res = await adapter.testConnection();
      await this.providerRepo.setProviderHealth(providerId, res.healthy, res.healthy ? null : res.message);
      return {
        ...res,
        timestamp: new Date().toISOString()
      };
    }

    // OpenAI Compatible / Anthropic / Custom
    const effectiveBaseUrl =
      provider.baseUrl ||
      (provider.type === 'anthropic' || provider.id === 'anthropic'
        ? 'https://api.anthropic.com'
        : 'https://api.openai.com/v1');

    if (!provider.apiKey) {
      await this.providerRepo.setProviderHealth(providerId, false, 'No API key configured');
      return {
        healthy: false,
        latencyMs: 0,
        message: 'Provider lacks configured API credentials.',
        timestamp: new Date().toISOString()
      };
    }

    try {
      const pingUrl = `${effectiveBaseUrl.replace(/\/$/, '')}/models`;
      const headers = {};
      if (provider.type === 'anthropic' || provider.id === 'anthropic') {
        headers['x-api-key'] = provider.apiKey;
        headers['anthropic-version'] = '2023-06-01';
      } else {
        headers['Authorization'] = `Bearer ${provider.apiKey}`;
      }

      const res = await safeFetch(
        pingUrl,
        {
          method: 'GET',
          headers,
          timeoutMs: 8000
        },
        'conn_test'
      );

      const latencyMs = Date.now() - startTime;
      const healthy = res.ok;
      let message;
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        const count = Array.isArray(body.data) ? body.data.length : (Array.isArray(body.models) ? body.models.length : 0);
        message = `Endpoint reachable & credentials verified (HTTP ${res.status}, ${count} models). Response in ${latencyMs}ms.`;
      } else if (res.status === 401 || res.status === 403) {
        message = `Endpoint reachable but authentication failed (HTTP ${res.status}). Please verify your API key.`;
      } else {
        message = `Endpoint returned HTTP ${res.status} (${res.statusText || 'Error'}).`;
      }

      await this.providerRepo.setProviderHealth(providerId, healthy, healthy ? null : message);
      return { healthy, latencyMs, message, timestamp: new Date().toISOString() };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      await this.providerRepo.setProviderHealth(providerId, false, err.message);
      return {
        healthy: false,
        latencyMs,
        message: `Connection failed: ${err.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  async getUsageStats(organizationId, { limit, offset, model, provider, callerId } = {}) {
    if (!organizationId) {
      throw new BadRequestError('Organization identifier is required to query usage.');
    }
    return this.usageRepo.getUsageSummary(organizationId, { limit, offset, model, provider, callerId });
  }
}

module.exports = {
  ModelManagementService,
  modelManagementService: new ModelManagementService()
};
