// Completion Usage Repository

const { getPrismaClient } = require('../config/database');
const { generateUsageId } = require('../utils/correlationId');
const { logger } = require('../utils/logger');

class UsageRepository {
  constructor() {
    this._inMemoryUsage = [];
    this._forceInMemory = false;
  }

  setForceInMemory(val) {
    this._forceInMemory = val;
  }

  clear() {
    this._inMemoryUsage = [];
  }

  /**
   * Persists a completion usage record.
   */
  async recordUsage({
    requestId,
    traceId,
    organizationId,
    callerId,
    provider,
    model,
    promptTokens = 0,
    completionTokens = 0,
    totalTokens = 0,
    latencyMs = 0,
    status = 'COMPLETED',
    errorCode = null
  }) {
    const id = generateUsageId();
    const now = new Date();

    const record = {
      id,
      requestId: requestId || null,
      traceId: traceId || null,
      organizationId,
      callerId: callerId || null,
      provider,
      model,
      promptTokens: Math.max(0, promptTokens),
      completionTokens: Math.max(0, completionTokens),
      totalTokens: Math.max(0, totalTokens),
      latencyMs: Math.max(0, latencyMs),
      status,
      errorCode: errorCode || null,
      createdAt: now
    };

    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        return await prisma.completionUsage.create({
          data: record
        });
      } catch (err) {
        logger.debug({ err: err.message }, 'Database write failed for usage record, using in-memory');
      }
    }

    this._inMemoryUsage.push({ ...record });
    return record;
  }

  /**
   * Queries aggregated usage summary for an organization.
   */
  async getUsageSummary(organizationId, { limit = 50, offset = 0, model, provider, callerId } = {}) {
    if (!this._forceInMemory) {
      try {
        const prisma = getPrismaClient();
        const where = { organizationId };
        if (model) where.model = model;
        if (provider) where.provider = provider;
        if (callerId) where.callerId = callerId;

        const [items, total] = await Promise.all([
          prisma.completionUsage.findMany({
            where,
            skip: offset,
            take: limit,
            orderBy: { createdAt: 'desc' }
          }),
          prisma.completionUsage.count({ where })
        ]);

        return { items, total };
      } catch (err) {
        logger.debug({ err: err.message }, 'Database read failed for usage query, using in-memory');
      }
    }

    let filtered = this._inMemoryUsage.filter((u) => u.organizationId === organizationId);
    if (model) filtered = filtered.filter((u) => u.model === model);
    if (provider) filtered = filtered.filter((u) => u.provider === provider);
    if (callerId) filtered = filtered.filter((u) => u.callerId === callerId);

    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = filtered.length;
    const items = filtered.slice(offset, offset + limit);

    return { items, total };
  }
}

module.exports = {
  UsageRepository,
  usageRepository: new UsageRepository()
};
