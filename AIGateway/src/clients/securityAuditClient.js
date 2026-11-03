// Security & Audit Service REST Client Integration

const { env } = require('../config/env');
const { ServiceUnavailableError, NotFoundError } = require('../utils/errors');
const { logger } = require('../utils/logger');

class SecurityAuditClient {
  constructor(baseUrl = env.securityAuditUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this._mockHandler = null;
    this._mockTraceHandler = null;
  }

  /**
   * Emits a privacy-safe security or audit event to Service 6.
   *
   * @param {object} event
   * @param {string} event.eventType e.g. "AI_REQUEST_RECEIVED", "REQUEST_BLOCKED", "REQUEST_COMPLETED"
   * @param {string} event.traceId
   * @param {string} event.requestId
   * @param {string} event.organizationId
   * @param {string} event.callerId
   * @param {'INFO' | 'WARN' | 'CRITICAL'} [event.severity='INFO']
   * @param {object} [event.details] Sanitized metadata only, never raw credentials or secrets
   * @param {string} [event.correlationId]
   */
  async emitSecurityEvent(event) {
    if (this._mockHandler) {
      return this._mockHandler(event);
    }

    const url = `${this.baseUrl}/v1/events`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout for audit

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-Id': event.correlationId || 'unknown'
        },
        body: JSON.stringify({
          ...event,
          timestamp: new Date().toISOString()
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.warn(
          { traceId: event.traceId, status: response.status },
          'Security & Audit Service returned non-ok status for event emission'
        );
      }
    } catch (err) {
      clearTimeout(timeoutId);

      // Distinguish critical audit logging from telemetry
      if (event.severity === 'CRITICAL') {
        logger.error(
          { traceId: event.traceId, err: err.message },
          'Failed to record CRITICAL security event in Audit Service'
        );
      } else {
        logger.warn(
          { traceId: event.traceId, err: err.message },
          'Best-effort audit event delivery failed'
        );
      }
    }
  }

  /**
   * Retrieves request trace events for a given traceId.
   *
   * @param {string} traceId
   * @param {string} organizationId
   * @param {string} correlationId
   * @returns {Promise<{ traceId: string, events: Array<object> }>}
   */
  async getTrace(traceId, organizationId, correlationId) {
    if (this._mockTraceHandler) {
      return this._mockTraceHandler(traceId, organizationId, correlationId);
    }

    const url = `${this.baseUrl}/v1/traces/${encodeURIComponent(traceId)}?organizationId=${encodeURIComponent(organizationId)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), env.requestTimeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-Id': correlationId || 'unknown'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.status === 404) {
        throw new NotFoundError(`No trace found for traceId: ${traceId}`);
      }

      if (!response.ok) {
        throw new ServiceUnavailableError(
          `Security & Audit Service returned error status ${response.status} when fetching trace.`
        );
      }

      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof NotFoundError || err instanceof ServiceUnavailableError) {
        throw err;
      }

      logger.warn(
        { correlationId, traceId, err: err.message },
        'Downstream failure fetching trace from Audit Service'
      );

      // Return provisional safe trace response if audit service is not yet deployed
      return {
        traceId,
        requestId: null,
        events: [
          {
            eventType: 'GATEWAY_TRACE_FALLBACK',
            timestamp: new Date().toISOString(),
            details: { message: 'Security & Audit service is not yet connected.' }
          }
        ]
      };
    }
  }

  setMockHandler(handler) {
    this._mockHandler = handler;
  }

  setMockTraceHandler(handler) {
    this._mockTraceHandler = handler;
  }

  resetMocks() {
    this._mockHandler = null;
    this._mockTraceHandler = null;
  }
}

const defaultSecurityAuditClient = new SecurityAuditClient();

module.exports = {
  SecurityAuditClient,
  securityAuditClient: defaultSecurityAuditClient
};
