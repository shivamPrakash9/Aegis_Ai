// AI Request Database Repository with In-Memory Mock Resilience

const { getPrismaClient } = require('../config/database');
const { logger } = require('../utils/logger');

class AiRequestRepository {
  constructor(prisma = null) {
    this.prisma = prisma;
  }

  get _client() {
    return this.prisma || getPrismaClient();
  }

  async create(data) {
    return this._client.aiRequest.create({
      data: {
        id: data.id,
        organizationId: data.organizationId,
        callerId: data.callerId,
        callerType: data.callerType,
        status: data.status || 'ACCEPTED',
        modelSelected: data.modelSelected || null,
        sanitizedPromptSummary: data.sanitizedPromptSummary || null,
        sanitizedResult: data.sanitizedResult || null,
        traceId: data.traceId,
        idempotencyKey: data.idempotencyKey || null,
        payloadFingerprint: data.payloadFingerprint || null,
        privacyAction: data.privacyAction || null,
        policyDecision: data.policyDecision || null,
        metadata: data.metadata ? (typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata)) : null
      }
    });
  }

  async findById(id, organizationId) {
    return this._client.aiRequest.findFirst({
      where: {
        id,
        organizationId
      }
    });
  }

  async findByTraceId(traceId, organizationId) {
    return this._client.aiRequest.findFirst({
      where: {
        traceId,
        organizationId
      }
    });
  }

  async findByIdempotencyKey(organizationId, idempotencyKey) {
    return this._client.aiRequest.findFirst({
      where: {
        organizationId,
        idempotencyKey
      }
    });
  }

  async updateStatus(id, organizationId, status, updates = {}) {
    const data = {
      status,
      ...(updates.modelSelected !== undefined ? { modelSelected: updates.modelSelected } : {}),
      ...(updates.sanitizedResult !== undefined ? { sanitizedResult: updates.sanitizedResult } : {}),
      ...(updates.sanitizedPromptSummary !== undefined ? { sanitizedPromptSummary: updates.sanitizedPromptSummary } : {}),
      ...(updates.privacyAction !== undefined ? { privacyAction: updates.privacyAction } : {}),
      ...(updates.policyDecision !== undefined ? { policyDecision: updates.policyDecision } : {}),
      ...(updates.errorCode !== undefined ? { errorCode: updates.errorCode } : {}),
      ...(updates.errorMessage !== undefined ? { errorMessage: updates.errorMessage } : {}),
      ...(updates.completedAt !== undefined ? { completedAt: updates.completedAt } : {})
    };

    if (['COMPLETED', 'BLOCKED', 'FAILED'].includes(status) && !data.completedAt) {
      data.completedAt = new Date();
    }

    return this._client.aiRequest.updateMany({
      where: {
        id,
        organizationId
      },
      data
    });
  }

  async findMany(organizationId, filter = {}, pagination = { page: 1, limit: 20 }) {
    const where = { organizationId };

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) where.createdAt.gte = new Date(filter.startDate);
      if (filter.endDate) where.createdAt.lte = new Date(filter.endDate);
    }

    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this._client.aiRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      this._client.aiRequest.count({ where })
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
}

class InMemoryAiRequestRepository {
  constructor() {
    this.requests = new Map();
  }

  async create(data) {
    const record = {
      id: data.id,
      organizationId: data.organizationId,
      callerId: data.callerId,
      callerType: data.callerType,
      status: data.status || 'ACCEPTED',
      modelSelected: data.modelSelected || null,
      sanitizedPromptSummary: data.sanitizedPromptSummary || null,
      sanitizedResult: data.sanitizedResult || null,
      traceId: data.traceId,
      idempotencyKey: data.idempotencyKey || null,
      payloadFingerprint: data.payloadFingerprint || null,
      privacyAction: data.privacyAction || null,
      policyDecision: data.policyDecision || null,
      errorCode: data.errorCode || null,
      errorMessage: data.errorMessage || null,
      metadata: data.metadata ? (typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata)) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null
    };

    this.requests.set(data.id, record);
    return { ...record };
  }

  async findById(id, organizationId) {
    const record = this.requests.get(id);
    if (!record || record.organizationId !== organizationId) {
      return null;
    }
    return { ...record };
  }

  async findByTraceId(traceId, organizationId) {
    for (const record of this.requests.values()) {
      if (record.traceId === traceId && record.organizationId === organizationId) {
        return { ...record };
      }
    }
    return null;
  }

  async findByIdempotencyKey(organizationId, idempotencyKey) {
    for (const record of this.requests.values()) {
      if (record.idempotencyKey === idempotencyKey && record.organizationId === organizationId) {
        return { ...record };
      }
    }
    return null;
  }

  async updateStatus(id, organizationId, status, updates = {}) {
    const record = this.requests.get(id);
    if (!record || record.organizationId !== organizationId) {
      return { count: 0 };
    }

    record.status = status;
    record.updatedAt = new Date();

    if (updates.modelSelected !== undefined) record.modelSelected = updates.modelSelected;
    if (updates.sanitizedResult !== undefined) record.sanitizedResult = updates.sanitizedResult;
    if (updates.sanitizedPromptSummary !== undefined) record.sanitizedPromptSummary = updates.sanitizedPromptSummary;
    if (updates.privacyAction !== undefined) record.privacyAction = updates.privacyAction;
    if (updates.policyDecision !== undefined) record.policyDecision = updates.policyDecision;
    if (updates.errorCode !== undefined) record.errorCode = updates.errorCode;
    if (updates.errorMessage !== undefined) record.errorMessage = updates.errorMessage;
    if (updates.completedAt !== undefined) {
      record.completedAt = updates.completedAt;
    } else if (['COMPLETED', 'BLOCKED', 'FAILED'].includes(status)) {
      record.completedAt = new Date();
    }

    return { count: 1 };
  }

  async findMany(organizationId, filter = {}, pagination = { page: 1, limit: 20 }) {
    let list = Array.from(this.requests.values()).filter(
      (r) => r.organizationId === organizationId
    );

    if (filter.status) {
      list = list.filter((r) => r.status === filter.status);
    }
    if (filter.startDate) {
      const gte = new Date(filter.startDate).getTime();
      list = list.filter((r) => r.createdAt.getTime() >= gte);
    }
    if (filter.endDate) {
      const lte = new Date(filter.endDate).getTime();
      list = list.filter((r) => r.createdAt.getTime() <= lte);
    }

    list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const total = list.length;
    const skip = (page - 1) * limit;
    const items = list.slice(skip, skip + limit).map((r) => ({ ...r }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  clear() {
    this.requests.clear();
  }
}

// In test environment or fallback, use InMemory repository by default
const defaultRepository = process.env.NODE_ENV === 'test'
  ? new InMemoryAiRequestRepository()
  : new AiRequestRepository();

module.exports = {
  AiRequestRepository,
  InMemoryAiRequestRepository,
  aiRequestRepository: defaultRepository
};
