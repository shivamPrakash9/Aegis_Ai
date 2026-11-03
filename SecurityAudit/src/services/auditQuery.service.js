// Audit Event Query and Trace Aggregation Service

const { auditEventRepository } = require('../repositories/auditEvent.repository');
const { integrityService } = require('./integrity.service');
const { NotFoundError, BadRequestError } = require('../utils/errors');

class AuditQueryService {
  constructor(repo = auditEventRepository, integrity = integrityService) {
    this.repo = repo;
    this.integrity = integrity;
  }

  /**
   * Cleans input to prevent NoSQL query operator injection.
   *
   * @param {string} val
   * @returns {string}
   */
  sanitizeQueryParam(val) {
    if (typeof val !== 'string') return val;
    // Reject or strip operators starting with $ or containing .
    return val.replace(/[$.]/g, '');
  }

  /**
   * Retrieves full request lifecycle trace by traceId.
   * Directly consumed by AI Gateway's securityAuditClient.getTrace().
   *
   * @param {string} traceId
   * @param {string} organizationId
   * @returns {Promise<{ traceId: string, requestId: string | null, events: Array<object> }>}
   */
  async getTrace(traceId, organizationId, callerId = null) {
    if (!traceId) {
      throw new BadRequestError('traceId parameter is required.');
    }
    if (!organizationId) {
      throw new BadRequestError('organizationId parameter is required for tenant isolation.');
    }

    const safeTraceId = this.sanitizeQueryParam(traceId);
    const safeOrgId = this.sanitizeQueryParam(organizationId);

    const events = await this.repo.findEventsByTraceId(safeTraceId, safeOrgId);

    if (!events || events.length === 0) {
      throw new NotFoundError(`No audit trace found for traceId: ${traceId}`);
    }

    if (callerId) {
      const hasForeignCaller = events.some((e) => e.callerId && e.callerId !== callerId);
      if (hasForeignCaller) {
        throw new NotFoundError(`No audit trace found for traceId: ${traceId}`);
      }
    }

    // Determine requestId from first event containing it
    const requestEvent = events.find((e) => e.requestId);
    const requestId = requestEvent ? requestEvent.requestId : null;

    return {
      traceId: safeTraceId,
      requestId,
      events: events.map((e) => ({
        eventId: e.eventId,
        eventType: e.eventType,
        timestamp: e.occurredAt || e.ingestedAt,
        severity: e.severity || 'INFO',
        outcome: e.outcome || null,
        details: e.details || {}
      }))
    };
  }

  /**
   * Retrieves a single event by eventId scoped to organization and optionally callerId.
   *
   * @param {string} eventId
   * @param {string} organizationId
   * @param {string|null} [callerId]
   * @returns {Promise<object>}
   */
  async getEventById(eventId, organizationId, callerId = null) {
    const safeEventId = this.sanitizeQueryParam(eventId);
    const safeOrgId = this.sanitizeQueryParam(organizationId);

    const event = await this.repo.findByEventId(safeEventId, safeOrgId);
    if (!event) {
      throw new NotFoundError(`Audit event with ID '${eventId}' not found.`);
    }

    if (callerId && event.callerId && event.callerId !== callerId) {
      throw new NotFoundError(`Audit event with ID '${eventId}' not found.`);
    }

    return event;
  }

  /**
   * Retrieves all events associated with an AI Request ID.
   *
   * @param {string} requestId
   * @param {string} organizationId
   * @param {string|null} [callerId]
   * @returns {Promise<{ requestId: string, organizationId: string, events: Array<object> }>}
   */
  async getRequestEvents(requestId, organizationId, callerId = null) {
    const safeReqId = this.sanitizeQueryParam(requestId);
    const safeOrgId = this.sanitizeQueryParam(organizationId);

    const events = await this.repo.findEventsByRequestId(safeReqId, safeOrgId);

    if (callerId && events.length > 0) {
      const hasForeignCaller = events.some((e) => e.callerId && e.callerId !== callerId);
      if (hasForeignCaller) {
        throw new NotFoundError(`No audit events found for requestId: ${requestId}`);
      }
    }

    return {
      requestId: safeReqId,
      organizationId: safeOrgId,
      events
    };
  }

  /**
   * Performs multi-criteria search over audit events with pagination and tenant isolation.
   *
   * @param {object} params
   * @returns {Promise<{ data: Array<object>, pagination: object }>}
   */
  async searchEvents(params) {
    const {
      organizationId,
      callerId,
      eventType,
      severity,
      outcome,
      sourceService,
      requestId,
      traceId,
      startTime,
      endTime,
      page,
      limit
    } = params;

    if (!organizationId) {
      throw new BadRequestError('organizationId is required for audit event queries.');
    }

    const cleanParams = {
      organizationId: this.sanitizeQueryParam(organizationId),
      callerId: callerId ? this.sanitizeQueryParam(callerId) : undefined,
      eventType: eventType ? this.sanitizeQueryParam(eventType) : undefined,
      severity: severity ? this.sanitizeQueryParam(severity) : undefined,
      outcome: outcome ? this.sanitizeQueryParam(outcome) : undefined,
      sourceService: sourceService ? this.sanitizeQueryParam(sourceService) : undefined,
      requestId: requestId ? this.sanitizeQueryParam(requestId) : undefined,
      traceId: traceId ? this.sanitizeQueryParam(traceId) : undefined,
      startTime,
      endTime,
      page,
      limit
    };

    const result = await this.repo.findEvents(cleanParams);

    return {
      data: result.items,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    };
  }

  /**
   * Cryptographically verifies the tamper status of an audit event.
   *
   * @param {string} eventId
   * @param {string} organizationId
   * @returns {Promise<{ eventId: string, verified: boolean, digest: string, algorithm: string, reason: string }>}
   */
  async verifyEvent(eventId, organizationId) {
    const event = await this.getEventById(eventId, organizationId);
    const verification = this.integrity.verifyIntegrity(event);

    return {
      eventId: event.eventId,
      valid: verification.valid,
      verified: verification.valid,
      digest: verification.calculatedDigest,
      storedDigest: verification.storedDigest,
      algorithm: 'sha256',
      reason: verification.reason
    };
  }
}

const auditQueryService = new AuditQueryService();

module.exports = {
  AuditQueryService,
  auditQueryService
};
