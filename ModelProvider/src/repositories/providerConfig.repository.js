// Provider Configuration Repository

const { getPrismaClient } = require('../config/database');
const { logger } = require('../utils/logger');
const { env } = require('../config/env');
const { encryptSecret, decryptSecret } = require('../utils/crypto');
const { BadRequestError, NotFoundError } = require('../utils/errors');

const DEFAULT_PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai',
    baseUrl: env.openaiBaseUrl || 'https://api.openai.com/v1',
    apiKey: env.openaiApiKey || null,
    enabled: true,
    isHealthy: Boolean(env.openaiApiKey),
    isBuiltin: true
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'anthropic',
    baseUrl: env.anthropicBaseUrl || 'https://api.anthropic.com',
    apiKey: env.anthropicApiKey || null,
    enabled: true,
    isHealthy: Boolean(env.anthropicApiKey),
    isBuiltin: true
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    type: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiKey: process.env.GEMINI_API_KEY || null,
    enabled: true,
    isHealthy: Boolean(process.env.GEMINI_API_KEY),
    isBuiltin: true
  },
  {
    id: 'groq',
    name: 'Groq Cloud',
    type: 'openai',
    baseUrl: env.groqBaseUrl || 'https://api.groq.com/openai/v1',
    apiKey: env.groqApiKey || null,
    enabled: true,
    isHealthy: Boolean(env.groqApiKey),
    isBuiltin: true
  },
  {
    id: 'mock',
    name: 'Mock Provider (Local Dev)',
    type: 'mock',
    baseUrl: null,
    apiKey: 'mock-key',
    enabled: true,
    isHealthy: true,
    isBuiltin: true
  }
];

class ProviderConfigRepository {
  constructor() {
    this._inMemoryConfigs = new Map();
    this._forceInMemory = false;
    for (const p of DEFAULT_PROVIDERS) {
      this._inMemoryConfigs.set(p.id.toLowerCase(), {
        ...p,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }

  setForceInMemory(val) {
    this._forceInMemory = val;
  }

  clear() {
    this._inMemoryConfigs.clear();
  }

  async saveProviderConfig({
    id,
    name,
    type = 'openai',
    baseUrl = null,
    apiKey = null,
    description = null,
    organizationId = null,
    enabled = true,
    isHealthy = true
  }) {
    const key = String(id).toLowerCase().trim();
    const now = new Date();

    // Check if provider already exists in DB or memory
    const existing = await this.findByProviderId(key, true);

    let effectiveApiKey = apiKey ? apiKey.trim() : null;
    if ((!effectiveApiKey || effectiveApiKey.includes('••••')) && existing && existing.apiKey) {
      effectiveApiKey = existing.apiKey; // Preserve existing key
    }

    const record = {
      id: key,
      name: name ? name.trim() : key,
      type: type ? type.trim().toLowerCase() : 'openai',
      baseUrl: baseUrl ? baseUrl.trim() : null,
      apiKey: effectiveApiKey,
      description: description ? description.trim() : (existing?.description || null),
      organizationId: organizationId || existing?.organizationId || null,
      enabled: enabled !== false,
      isHealthy: Boolean(isHealthy),
      lastConnectedAt: existing?.lastConnectedAt || null,
      lastError: existing?.lastError || null,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };

    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        const encryptedApiKey = record.apiKey ? encryptSecret(record.apiKey) : null;
        await prisma.providerConfig.upsert({
          where: { id: key },
          update: {
            name: record.name,
            type: record.type,
            baseUrl: record.baseUrl,
            apiKey: encryptedApiKey,
            description: record.description,
            organizationId: record.organizationId,
            enabled: record.enabled,
            isHealthy: record.isHealthy,
            updatedAt: now
          },
          create: {
            id: record.id,
            name: record.name,
            type: record.type,
            baseUrl: record.baseUrl,
            apiKey: encryptedApiKey,
            description: record.description,
            organizationId: record.organizationId,
            enabled: record.enabled,
            isHealthy: record.isHealthy,
            createdAt: now,
            updatedAt: now
          }
        });
      } catch (err) {
        logger.debug({ err: err.message }, 'Database write failed for providerConfig, using in-memory');
      }
    }

    this._inMemoryConfigs.set(key, { ...record });
    return this.toSafeProvider(record);
  }

  async updateProviderConfig(id, data = {}) {
    const key = String(id || '').toLowerCase().trim();
    const existing = await this.findByProviderId(key, true);
    if (!existing) {
      throw new NotFoundError(`Provider '${key}' not found.`);
    }

    const now = new Date();
    let effectiveApiKey = existing.apiKey;
    if (data.apiKey && typeof data.apiKey === 'string' && data.apiKey.trim().length > 0 && !data.apiKey.includes('••••')) {
      effectiveApiKey = data.apiKey.trim();
    }

    const updatedRecord = {
      ...existing,
      name: data.name !== undefined ? data.name.trim() : existing.name,
      type: data.type !== undefined ? data.type.trim().toLowerCase() : existing.type,
      baseUrl: data.baseUrl !== undefined ? (data.baseUrl ? data.baseUrl.trim() : null) : existing.baseUrl,
      apiKey: effectiveApiKey,
      description: data.description !== undefined ? data.description : existing.description,
      organizationId: data.organizationId !== undefined ? data.organizationId : existing.organizationId,
      enabled: data.enabled !== undefined ? Boolean(data.enabled) : existing.enabled,
      isHealthy: data.isHealthy !== undefined ? Boolean(data.isHealthy) : existing.isHealthy,
      updatedAt: now
    };

    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        const encryptedApiKey = updatedRecord.apiKey ? encryptSecret(updatedRecord.apiKey) : null;
        await prisma.providerConfig.update({
          where: { id: key },
          data: {
            name: updatedRecord.name,
            type: updatedRecord.type,
            baseUrl: updatedRecord.baseUrl,
            apiKey: encryptedApiKey,
            description: updatedRecord.description,
            organizationId: updatedRecord.organizationId,
            enabled: updatedRecord.enabled,
            isHealthy: updatedRecord.isHealthy,
            updatedAt: now
          }
        });
      } catch (err) {
        logger.debug({ err: err.message }, 'Database update failed for providerConfig');
      }
    }

    this._inMemoryConfigs.set(key, updatedRecord);
    return this.toSafeProvider(updatedRecord);
  }

  async findByProviderId(id, includeSecret = false) {
    const key = String(id || '').toLowerCase().trim();
    let record = null;

    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        record = await prisma.providerConfig.findUnique({
          where: { id: key }
        });
        if (record && record.apiKey) {
          record.apiKey = decryptSecret(record.apiKey);
        }
      } catch (err) {
        logger.debug({ err: err.message }, 'Database read failed for providerConfig lookup, using in-memory');
      }
    }

    if (!record) {
      record = this._inMemoryConfigs.get(key) || null;
    }

    if (!record) return null;
    return includeSecret ? { ...record } : this.toSafeProvider(record);
  }

  async listAll({ enabledOnly = false } = {}) {
    let dbItems = [];
    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        const where = enabledOnly ? { enabled: true } : {};
        dbItems = await prisma.providerConfig.findMany({
          where,
          orderBy: { id: 'asc' }
        });
        for (const item of dbItems) {
          if (item.apiKey) {
            item.apiKey = decryptSecret(item.apiKey);
          }
        }
      } catch (err) {
        logger.debug({ err: err.message }, 'Database read failed for providerConfig list, using in-memory');
      }
    }

    // Merge default providers and DB items
    const map = new Map(this._inMemoryConfigs);
    for (const item of dbItems) {
      map.set(item.id.toLowerCase(), { ...item });
    }

    let items = Array.from(map.values());
    if (enabledOnly) items = items.filter((p) => p.enabled);
    items.sort((a, b) => a.id.localeCompare(b.id));

    return items.map((p) => this.toSafeProvider(p));
  }

  async setProviderStatus(id, enabled) {
    const key = String(id || '').toLowerCase().trim();
    const now = new Date();

    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        await prisma.providerConfig.update({
          where: { id: key },
          data: { enabled: Boolean(enabled), updatedAt: now }
        });
      } catch (err) {
        logger.debug({ err: err.message }, 'Database update failed for providerConfig status');
      }
    }

    const existing = this._inMemoryConfigs.get(key);
    if (existing) {
      existing.enabled = Boolean(enabled);
      existing.updatedAt = now;
      return this.toSafeProvider(existing);
    }
    return null;
  }

  async setProviderHealth(id, isHealthy, lastError = null) {
    const key = String(id || '').toLowerCase().trim();
    const now = new Date();

    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        await prisma.providerConfig.update({
          where: { id: key },
          data: {
            isHealthy: Boolean(isHealthy),
            lastConnectedAt: isHealthy ? now : undefined,
            lastError: lastError ? String(lastError).slice(0, 500) : null,
            updatedAt: now
          }
        });
      } catch (err) {
        logger.debug({ err: err.message }, 'Database update failed for providerConfig health');
      }
    }

    const existing = this._inMemoryConfigs.get(key);
    if (existing) {
      existing.isHealthy = Boolean(isHealthy);
      if (isHealthy) existing.lastConnectedAt = now;
      existing.lastError = lastError ? String(lastError).slice(0, 500) : null;
      existing.updatedAt = now;
      return this.toSafeProvider(existing);
    }
    return null;
  }

  async deleteProvider(id) {
    const key = String(id || '').toLowerCase().trim();
    if (['openai', 'anthropic', 'mock', 'gemini'].includes(key)) {
      throw new BadRequestError(`Built-in provider '${key}' cannot be deleted. You can disable it instead.`);
    }

    const existing = await this.findByProviderId(key);
    if (!existing) {
      throw new NotFoundError(`Provider '${key}' not found.`);
    }

    // Safety check: ensure no models depend on this provider
    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        const boundModels = await prisma.modelConfig.count({
          where: { provider: key }
        });
        if (boundModels > 0) {
          throw new BadRequestError(
            `Cannot delete provider '${key}' because ${boundModels} registered model(s) are associated with it. Please reassign or delete those models first.`
          );
        }
        await prisma.providerConfig.deleteMany({
          where: { id: key }
        });
      } catch (err) {
        if (err instanceof BadRequestError) throw err;
        logger.debug({ err: err.message }, 'Database delete failed for providerConfig');
      }
    }

    this._inMemoryConfigs.delete(key);
    return { success: true, id: key };
  }

  /**
   * Masks secret API keys before returning to callers.
   */
  toSafeProvider(provider) {
    if (!provider) return null;
    const hasKey = Boolean(provider.apiKey && provider.apiKey.length > 0);
    let apiKeyMasked = null;
    if (hasKey) {
      const k = String(provider.apiKey);
      apiKeyMasked = k.length > 8 ? `••••••••${k.slice(-4)}` : '••••••••';
    }

    return {
      id: provider.id,
      name: provider.name,
      type: provider.type,
      baseUrl: provider.baseUrl,
      description: provider.description || null,
      organizationId: provider.organizationId || null,
      apiKeyConfigured: hasKey,
      apiKeyMasked,
      enabled: provider.enabled,
      isHealthy: provider.isHealthy,
      lastConnectedAt: provider.lastConnectedAt ? new Date(provider.lastConnectedAt).toISOString() : null,
      lastError: provider.lastError || null,
      createdAt: provider.createdAt ? new Date(provider.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: provider.updatedAt ? new Date(provider.updatedAt).toISOString() : new Date().toISOString()
    };
  }
}

module.exports = {
  ProviderConfigRepository,
  providerConfigRepository: new ProviderConfigRepository()
};
