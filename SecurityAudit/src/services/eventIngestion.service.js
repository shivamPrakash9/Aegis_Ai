// Audit Event Ingestion Orchestration Service

const { eventValidationService } = require('./eventValidation.service');
const { eventSanitizationService } = require('./eventSanitization.service');
const { integrityService } = require('./integrity.service');
const { auditEventRepository } = require('../repositories/auditEvent.repository');
const { generateEventId } = require('../utils/correlationId');
const { BadRequestError } = require('../utils/errors');
const { logger } = require('../utils/logger');

class EventIngestionService {
  constructor(
    repo = auditEventRepository,
    validator = eventValidationService,
    sanitizer = eventSanitizationService,
    integrity = integrityService
  ) {
    this.repo = repo;
    this.validator = validator;
    this.sanitizer = sanitizer;
    this.integrity = integrity;
  }

  /**
   * Ingests, sanitizes, cryptographically signs, and persists an audit event.
   *
   * @param {object} rawEvent Incoming raw event payload
   * @param {object} context Caller authentication context { principal, isInternalService }
   * @returns {Promise<{ accepted: boolean, eventId: string, status: 'PERSISTED' | 'DUPLICATE' }>}
   */
  async ingestEvent(rawEvent, context = {}) {
    // 1. Schema and Taxonomy Validation
    this.validator.validateEvent(rawEvent);

    // 2. Establish trusted organization context
    const organizationId =
      rawEvent.organizationId ||
      context.principal?.organizationId ||
      null;

    if (!organizationId) {
      throw new BadRequestError('Organization context (organizationId) is required for audit event ingestion.');
    }

    // 3. Establish source service identification
    const sourceService =
      rawEvent.sourceService ||
      (context.isInternalService ? 'internal-service' : 'client-api');

    // 4. Sanitize event metadata, strip raw prompts, credentials, tokens, PII
    const sanitizedEvent = this.sanitizer.sanitizeEvent(rawEvent);

    // 5. Generate stable Event ID and timestamps
    const eventId = sanitizedEvent.eventId || generateEventId();
    const eventVersion = sanitizedEvent.eventVersion || 1;
    const occurredAt = sanitizedEvent.occurredAt || sanitizedEvent.timestamp || new Date().toISOString();
    const ingestedAt = new Date().toISOString();

    const preparedEvent = {
      eventId,
      eventVersion,
      eventType: sanitizedEvent.eventType,
      occurredAt,
      ingestedAt,
      organizationId,
      sourceService,
      sourceEventId: sanitizedEvent.sourceEventId || null,
      requestId: sanitizedEvent.requestId || null,
      traceId: sanitizedEvent.traceId || null,
      callerId: sanitizedEvent.callerId || context.principal?.id || null,
      severity: sanitizedEvent.severity || 'INFO',
      outcome: sanitizedEvent.outcome || null,
      action: sanitizedEvent.action || null,
      reasonCode: sanitizedEvent.reasonCode || null,
      details: sanitizedEvent.details || sanitizedEvent.metadata || {},
      correlationId: sanitizedEvent.correlationId || null
    };

    // 6. Cryptographic Integrity Digest (SHA-256 canonical calculation)
    const integrityResult = this.integrity.calculateDigest(preparedEvent);
    preparedEvent.integrity = {
      digest: integrityResult.digest,
      algorithm: integrityResult.algorithm
    };

    // 7. Persist to MongoDB (Append-Only)
    const saveResult = await this.repo.save(preparedEvent);

    if (saveResult.isDuplicate) {
      logger.info(
        { eventId, organizationId, sourceEventId: preparedEvent.sourceEventId },
        'Duplicate audit event ignored cleanly'
      );
      return {
        accepted: true,
        eventId: saveResult.event?.eventId || eventId,
        status: 'DUPLICATE'
      };
    }

    logger.info(
      {
        eventId,
        eventType: preparedEvent.eventType,
        organizationId,
        traceId: preparedEvent.traceId,
        severity: preparedEvent.severity
      },
      'Security audit event ingested and persisted successfully'
    );

    return {
      accepted: true,
      eventId,
      status: 'PERSISTED'
    };
  }
}

const eventIngestionService = new EventIngestionService();

module.exports = {
  EventIngestionService,
  eventIngestionService
};
