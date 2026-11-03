// Model Configuration Repository

const { getPrismaClient } = require('../config/database');
const { generateModelConfigId } = require('../utils/correlationId');
const { logger } = require('../utils/logger');

class ModelConfigRepository {
  constructor() {
    this._inMemoryConfigs = new Map();
    this._forceInMemory = false;
  }

  setForceInMemory(val) {
    this._forceInMemory = val;
  }

  clear() {
    this._inMemoryConfigs.clear();
  }

  async saveModelConfig({
    modelId,
    provider,
    providerModelName,
    enabled = true,
    isDefault = false,
    maxTokens = 4096,
    contextWindow = 128000,
    defaultTemperature = 0.7,
    capabilities = ['chat'],
    description = null
  }) {
    const id = generateModelConfigId();
    const now = new Date();
    const record = {
      id,
      modelId,
      provider,
      providerModelName: providerModelName || modelId,
      enabled,
      isDefault,
      maxTokens,
      contextWindow,
      defaultTemperature,
      capabilities: JSON.stringify(capabilities),
      description,
      version: 1,
      createdAt: now,
      updatedAt: now
    };

    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        return await prisma.modelConfig.upsert({
          where: { modelId },
          update: {
            provider,
            providerModelName: record.providerModelName,
            enabled,
            isDefault,
            maxTokens,
            contextWindow,
            defaultTemperature,
            capabilities: record.capabilities,
            description,
            updatedAt: now
          },
          create: record
        });
      } catch (err) {
        logger.debug({ err: err.message }, 'Database write failed for modelConfig, using in-memory');
      }
    }

    this._inMemoryConfigs.set(modelId.toLowerCase(), { ...record });
    return record;
  }

  async findByModelId(modelId) {
    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        return await prisma.modelConfig.findUnique({
          where: { modelId }
        });
      } catch (err) {
        logger.debug({ err: err.message }, 'Database read failed for modelConfig lookup, using in-memory');
      }
    }

    return this._inMemoryConfigs.get(modelId.toLowerCase()) || null;
  }

  async listAll({ enabledOnly = false } = {}) {
    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        const where = enabledOnly ? { enabled: true } : {};
        return await prisma.modelConfig.findMany({
          where,
          orderBy: { modelId: 'asc' }
        });
      } catch (err) {
        logger.debug({ err: err.message }, 'Database read failed for modelConfig list, using in-memory');
      }
    }

    let items = Array.from(this._inMemoryConfigs.values());
    if (enabledOnly) items = items.filter((m) => m.enabled);
    items.sort((a, b) => a.modelId.localeCompare(b.modelId));
    return items;
  }
}

module.exports = {
  ModelConfigRepository,
  modelConfigRepository: new ModelConfigRepository()
};
