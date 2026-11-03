// Audit Query and Investigation Controller

const { auditQueryService } = require('../services/auditQuery.service');

class AuditQueryController {
  constructor(service = auditQueryService) {
    this.service = service;
  }

  /**
   * Helper to extract trusted organizationId from auth principal or request.
   */
  _getOrganizationId(req) {
    if (req.principal?.role === 'SUPER_ADMIN' || req.isInternalService) {
      return (
        req.query?.organizationId ||
        req.body?.organizationId ||
        req.principal?.organizationId ||
        null
      );
    }
    return req.principal?.organizationId || null;
  }

  /**
   * Helper to determine callerId for non-elevated users (DEVELOPER, MEMBER).
   */
  _getCallerId(req) {
    const isElevated = [
      'ORGANIZATION_ADMIN',
      'ADMIN',
      'SUPER_ADMIN',
      'SECURITY_AUDITOR'
    ].includes(req.principal?.role);

    if (isElevated || req.isInternalService) {
      return null;
    }
    return req.principal?.id || null;
  }

  /**
   * GET /v1/traces/:traceId
   * Retrieves request lifecycle trace events for AI Gateway.
   */
  async getTrace(req, res, next) {
    try {
      const { traceId } = req.params;
      const organizationId = this._getOrganizationId(req);
      const callerId = this._getCallerId(req);

      const result = await this.service.getTrace(traceId, organizationId, callerId);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /v1/events/:eventId
   * Retrieves a single audit event by ID.
   */
  async getEventById(req, res, next) {
    try {
      const { eventId } = req.params;
      const organizationId = this._getOrganizationId(req);
      const callerId = this._getCallerId(req);

      const result = await this.service.getEventById(eventId, organizationId, callerId);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /v1/requests/:requestId/events
   * Retrieves all audit events associated with an AI Request ID.
   */
  async getRequestEvents(req, res, next) {
    try {
      const { requestId } = req.params;
      const organizationId = this._getOrganizationId(req);
      const callerId = this._getCallerId(req);

      const result = await this.service.getRequestEvents(requestId, organizationId, callerId);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /v1/events
   * Searches audit events with filters and pagination.
   */
  async searchEvents(req, res, next) {
    try {
      const organizationId = this._getOrganizationId(req);
      const callerId = this._getCallerId(req);
      const {
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
      } = req.query;

      const result = await this.service.searchEvents({
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
      });

      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /v1/events/:eventId/verify
   * Cryptographically verifies the tamper-evidence digest of an audit event.
   */
  async verifyEvent(req, res, next) {
    try {
      const { eventId } = req.params;
      const organizationId = this._getOrganizationId(req);

      const result = await this.service.verifyEvent(eventId, organizationId);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

const auditQueryController = new AuditQueryController();

module.exports = {
  AuditQueryController,
  auditQueryController
};
