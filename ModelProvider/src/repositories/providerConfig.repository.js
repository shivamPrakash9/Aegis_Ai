// Provider Configuration Repository

const { getPrismaClient } = require('../config/database');
const { logger } = require('../utils/logger');
const { env } = require('../config/env');
const { encryptSecret, decryptSecret } = require('../utils/crypto');

const DEFAULT_PROVIDERS = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    type: 'gemini',
    baseUrl: env.geminiBaseUrl || 'https://generativelanguage.googleapis.com',
    apiKey: env.geminiApiKey || null,
    enabled: true,
    isHealthy: Boolean(env.geminiApiKey),
    isBuiltin: true
  },
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
    enabled = true,
    isHealthy = true
  }) {
    const key = String(id).toLowerCase().trim();
    const now = new Date();
    const record = {
      id: key,
      name: name ? name.trim() : key,
      type: type ? type.trim().toLowerCase() : 'openai',
      baseUrl: baseUrl ? baseUrl.trim() : null,
      apiKey: apiKey ? apiKey.trim() : null,
      enabled: enabled !== false,
      isHealthy: Boolean(isHealthy),
      createdAt: now,
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
            ...(apiKey !== null && apiKey !== undefined ? { apiKey: encryptedApiKey } : {}),
            enabled: record.enabled,
            isHealthy: record.isHealthy,
            updatedAt: now
          },
          create: {
            ...record,
            apiKey: encryptedApiKey
          }
        });
      } catch (err) {
        logger.debug({ err: err.message }, 'Database write failed for providerConfig, using in-memory');
      }
    }

    const existing = this._inMemoryConfigs.get(key) || {};
    this._inMemoryConfigs.set(key, { ...existing, ...record });
    return this.toSafeProvider(this._inMemoryConfigs.get(key));
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

  async setProviderHealth(id, isHealthy) {
    const key = String(id || '').toLowerCase().trim();
    const now = new Date();

    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        await prisma.providerConfig.update({
          where: { id: key },
          data: { isHealthy: Boolean(isHealthy), updatedAt: now }
        });
      } catch (err) {
        logger.debug({ err: err.message }, 'Database update failed for providerConfig health');
      }
    }

    const existing = this._inMemoryConfigs.get(key);
    if (existing) {
      existing.isHealthy = Boolean(isHealthy);
      existing.updatedAt = now;
      return this.toSafeProvider(existing);
    }
    return null;
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
      apiKeyMasked = k.length > 8 ? `${k.slice(0, 4)}...${k.slice(-4)}` : '****';
    }

    return {
      id: provider.id,
      name: provider.name,
      type: provider.type,
      baseUrl: provider.baseUrl,
      apiKeyConfigured: hasKey,
      apiKeyMasked,
      enabled: provider.enabled,
      isHealthy: provider.isHealthy,
      createdAt: provider.createdAt ? new Date(provider.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: provider.updatedAt ? new Date(provider.updatedAt).toISOString() : new Date().toISOString()
    };
  }
}

module.exports = {
  ProviderConfigRepository,
  providerConfigRepository: new ProviderConfigRepository()
};
