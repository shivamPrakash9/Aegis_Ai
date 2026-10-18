// AI Request Management Service

const { aiRequestRepository } = require('../repositories/aiRequest.repository');
const { requestPipelineService } = require('./requestPipeline.service');
const { securityAuditClient } = require('../clients/securityAuditClient');
const { NotFoundError } = require('../utils/errors');

class AiRequestService {
  constructor(
    repo = aiRequestRepository,
    pipeline = requestPipelineService,
    audit = securityAuditClient
  ) {
    this.repo = repo;
    this.pipeline = pipeline;
    this.audit = audit;
  }

  /**
   * Submits and orchestrates an AI Request.
   */
  async submitRequest({ principal, organizationId, idempotencyKey, payload, correlationId }) {
    return this.pipeline.processAiRequest({
      principal,
      organizationId,
      idempotencyKey,
      payload,
      correlationId
    });
  }

  /**
   * Retrieves an AI Request by ID, enforcing organization tenant isolation.
   *
   * @param {string} id
   * @param {string} organizationId
   * @returns {Promise<object>}
   */
  async getRequestById(id, organizationId) {
    const request = await this.repo.findById(id, organizationId);
    if (!request) {
      throw new NotFoundError(`AI Request with ID '${id}' not found in caller organization.`);
    }

    return {
      id: request.id,
      status: request.status,
      modelSelected: request.modelSelected,
      sanitizedResult: request.sanitizedResult,
      traceId: request.traceId,
      privacyAction: request.privacyAction,
      policyDecision: request.policyDecision,
      errorCode: request.errorCode,
      errorMessage: request.errorMessage,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
      completedAt: request.completedAt ? request.completedAt.toISOString() : null
    };
  }

  /**
   * Lists AI Requests scoped to caller organization with pagination and filters.
   *
   * @param {string} organizationId
   * @param {object} [filter]
   * @param {object} [pagination]
   * @returns {Promise<{ data: Array<object>, pagination: object }>}
   */
  async listRequests(organizationId, filter = {}, pagination = {}) {
    const result = await this.repo.findMany(organizationId, filter, pagination);

    const safeData = result.items.map((r) => ({
      id: r.id,
      status: r.status,
      modelSelected: r.modelSelected,
      sanitizedResult: r.sanitizedResult,
      traceId: r.traceId,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt ? r.completedAt.toISOString() : null
    }));

    return {
      data: safeData,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    };
  }

  /**
   * Retrieves audit trace for a specific AI Request.
   *
   * @param {string} id
   * @param {string} organizationId
   * @param {string} correlationId
   * @returns {Promise<object>}
   */
  async getRequestTrace(id, organizationId, correlationId) {
    const request = await this.repo.findById(id, organizationId);
    if (!request) {
      throw new NotFoundError(`AI Request with ID '${id}' not found in caller organization.`);
    }

    const traceData = await this.audit.getTrace(request.traceId, organizationId, correlationId);

    return {
      requestId: request.id,
      traceId: request.traceId,
      events: traceData.events || []
    };
  }
}

module.exports = {
  AiRequestService,
  aiRequestService: new AiRequestService()
};
