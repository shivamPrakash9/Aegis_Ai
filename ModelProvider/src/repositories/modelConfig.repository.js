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

  async updateModelConfig(modelId, data = {}) {
    const key = String(modelId || '').toLowerCase().trim();
    const existing = await this.findByModelId(modelId);
    if (!existing) {
      throw new Error(`Model '${modelId}' not found.`);
    }

    const now = new Date();
    const caps = data.capabilities !== undefined
      ? (Array.isArray(data.capabilities) ? JSON.stringify(data.capabilities) : JSON.stringify([String(data.capabilities)]))
      : existing.capabilities;

    const updated = {
      ...existing,
      provider: data.provider ? data.provider.trim() : existing.provider,
      providerModelName: data.providerModelName ? data.providerModelName.trim() : existing.providerModelName,
      contextWindow: data.contextWindow !== undefined ? parseInt(data.contextWindow, 10) : existing.contextWindow,
      maxTokens: data.maxTokens !== undefined ? parseInt(data.maxTokens, 10) : existing.maxTokens,
      defaultTemperature: data.defaultTemperature !== undefined ? parseFloat(data.defaultTemperature) : existing.defaultTemperature,
      capabilities: caps,
      description: data.description !== undefined ? data.description : existing.description,
      enabled: data.enabled !== undefined ? Boolean(data.enabled) : existing.enabled,
      isDefault: data.isDefault !== undefined ? Boolean(data.isDefault) : existing.isDefault,
      updatedAt: now
    };

    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        await prisma.modelConfig.update({
          where: { modelId: existing.modelId },
          data: {
            provider: updated.provider,
            providerModelName: updated.providerModelName,
            contextWindow: updated.contextWindow,
            maxTokens: updated.maxTokens,
            defaultTemperature: updated.defaultTemperature,
            capabilities: updated.capabilities,
            description: updated.description,
            enabled: updated.enabled,
            isDefault: updated.isDefault,
            updatedAt: now
          }
        });
      } catch (err) {
        logger.debug({ err: err.message }, 'Database update failed for modelConfig');
      }
    }

    this._inMemoryConfigs.set(key, updated);
    return updated;
  }

  async deleteModelConfig(modelId) {
    const key = String(modelId || '').toLowerCase().trim();
    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        await prisma.modelConfig.deleteMany({
          where: { modelId }
        });
      } catch (err) {
        logger.debug({ err: err.message }, 'Database delete failed for modelConfig');
      }
    }

    this._inMemoryConfigs.delete(key);
    return { success: true, modelId };
  }
}

module.exports = {
  ModelConfigRepository,
  modelConfigRepository: new ModelConfigRepository()
};
