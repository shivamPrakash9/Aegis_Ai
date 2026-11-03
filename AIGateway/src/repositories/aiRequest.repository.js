// AI Request Database Repository with In-Memory Mock Resilience
// Conforms to Web Services Assignment Requirements: Parameterized queries, Tenant isolation, Cursor pagination

const { getPrismaClient } = require('../config/database');
const { logger } = require('../utils/logger');

function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    return raw.trim() || cursor;
  } catch {
    return cursor;
  }
}

function encodeCursor(id) {
  return Buffer.from(String(id), 'utf8').toString('base64url');
}

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

  async findById(id, organizationId, callerId = null) {
    const where = { id, organizationId };
    if (callerId) {
      where.callerId = callerId;
    }
    return this._client.aiRequest.findFirst({
      where
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
      ...(updates.metadata !== undefined ? { metadata: typeof updates.metadata === 'string' ? updates.metadata : JSON.stringify(updates.metadata) } : {}),
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

    if (filter.callerId) {
      where.callerId = filter.callerId;
    }

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.model) {
      where.modelSelected = filter.model;
    }

    const searchTerm = filter.search || filter.q;
    if (searchTerm) {
      where.OR = [
        { id: { contains: searchTerm, mode: 'insensitive' } },
        { modelSelected: { contains: searchTerm, mode: 'insensitive' } },
        { sanitizedPromptSummary: { contains: searchTerm, mode: 'insensitive' } }
      ];
    }

    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) where.createdAt.gte = new Date(filter.startDate);
      if (filter.endDate) where.createdAt.lte = new Date(filter.endDate);
    }

    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const cursor = pagination.cursor ? decodeCursor(pagination.cursor) : null;

    if (cursor) {
      // Cursor-based pagination
      const items = await this._client.aiRequest.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        cursor: { id: cursor },
        skip: 1
      });

      const hasMore = items.length > limit;
      if (hasMore) {
        items.pop();
      }

      const total = await this._client.aiRequest.count({ where });
      const nextCursor = items.length > 0 && hasMore ? encodeCursor(items[items.length - 1].id) : null;
      const next = nextCursor ? `/v1/ai-requests?cursor=${nextCursor}&limit=${limit}` : null;

      return {
        items,
        total,
        page: pagination.page || 1,
        limit,
        totalPages: Math.ceil(total / limit),
        nextCursor,
        next,
        hasMore
      };
    }

    // Page-based pagination (backward compatibility)
    const page = Math.max(1, pagination.page || 1);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this._client.aiRequest.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit + 1
      }),
      this._client.aiRequest.count({ where })
    ]);

    const hasMore = items.length > limit;
    if (hasMore) {
      items.pop();
    }

    const nextCursor = items.length > 0 && hasMore ? encodeCursor(items[items.length - 1].id) : null;
    const next = nextCursor ? `/v1/ai-requests?cursor=${nextCursor}&limit=${limit}` : null;

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      nextCursor,
      next,
      hasMore
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

  async findById(id, organizationId, callerId = null) {
    const record = this.requests.get(id);
    if (!record || record.organizationId !== organizationId) {
      return null;
    }
    if (callerId && record.callerId !== callerId) {
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
    if (updates.metadata !== undefined) record.metadata = typeof updates.metadata === 'string' ? updates.metadata : JSON.stringify(updates.metadata);
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

    if (filter.callerId) {
      list = list.filter((r) => r.callerId === filter.callerId);
    }

    if (filter.status) {
      list = list.filter((r) => r.status === filter.status);
    }

    if (filter.model) {
      list = list.filter((r) => r.modelSelected === filter.model);
    }

    const searchTerm = filter.search || filter.q;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter((r) => {
        return (
          (r.id && r.id.toLowerCase().includes(term)) ||
          (r.modelSelected && r.modelSelected.toLowerCase().includes(term)) ||
          (r.sanitizedPromptSummary && r.sanitizedPromptSummary.toLowerCase().includes(term))
        );
      });
    }

    if (filter.startDate) {
      const gte = new Date(filter.startDate).getTime();
      list = list.filter((r) => r.createdAt.getTime() >= gte);
    }
    if (filter.endDate) {
      const lte = new Date(filter.endDate).getTime();
      list = list.filter((r) => r.createdAt.getTime() <= lte);
    }

    list.sort((a, b) => {
      const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.id.localeCompare(a.id);
    });

    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const total = list.length;
    const cursor = pagination.cursor ? decodeCursor(pagination.cursor) : null;

    let items = [];
    let hasMore = false;

    if (cursor) {
      const cursorIndex = list.findIndex((r) => r.id === cursor);
      if (cursorIndex !== -1) {
        items = list.slice(cursorIndex + 1, cursorIndex + 1 + limit);
        hasMore = cursorIndex + 1 + limit < list.length;
      } else {
        items = list.slice(0, limit);
        hasMore = limit < list.length;
      }
    } else {
      const page = Math.max(1, pagination.page || 1);
      const skip = (page - 1) * limit;
      items = list.slice(skip, skip + limit);
      hasMore = skip + limit < list.length;
    }

    const nextCursor = items.length > 0 && hasMore ? encodeCursor(items[items.length - 1].id) : null;
    const next = nextCursor ? `/v1/ai-requests?cursor=${nextCursor}&limit=${limit}` : null;

    return {
      items: items.map((r) => ({ ...r })),
      total,
      page: pagination.page || 1,
      limit,
      totalPages: Math.ceil(total / limit),
      nextCursor,
      next,
      hasMore
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
  aiRequestRepository: defaultRepository,
  encodeCursor,
  decodeCursor
};
