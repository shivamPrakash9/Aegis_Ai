// Event Schema and Taxonomy Validation Service

const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const { BadRequestError } = require('../utils/errors');

const ajv = new Ajv({ allErrors: true, coerceTypes: true });
addFormats(ajv);

const ALLOWED_SEVERITIES = ['INFO', 'WARN', 'CRITICAL'];

const ALLOWED_EVENT_TYPES = [
  // Authentication & Identity
  'AUTH_SUCCESS',
  'AUTH_FAILURE',
  'SESSION_REVOKED',
  'FORBIDDEN_ACCESS',
  'SERVICE_ACCOUNT_AUTH',

  // AI Gateway Lifecycle
  'AI_REQUEST_RECEIVED',
  'AI_REQUEST_ACCEPTED',
  'AI_REQUEST_PROCESSING',
  'AI_REQUEST_COMPLETED',
  'AI_REQUEST_FAILED',
  'AI_REQUEST_BLOCKED',
  'AI_REQUEST_BLOCKED_PRIVACY',
  'AI_REQUEST_BLOCKED_POLICY',
  'AI_REQUEST_WAITING_APPROVAL',

  // Privacy Scanner
  'PRIVACY_SCAN_COMPLETED',
  'SENSITIVE_DATA_DETECTED',
  'REQUEST_MASKED',
  'REQUEST_BLOCKED',
  'SCAN_FAILED',

  // Policy & Governance
  'POLICY_EVALUATION_COMPLETED',
  'POLICY_VIOLATION',
  'APPROVAL_REQUIRED',
  'APPROVAL_GRANTED',
  'APPROVAL_REJECTED',
  'APPROVAL_EXPIRED',

  // Model & Provider
  'MODEL_INVOCATION_STARTED',
  'MODEL_INVOCATION_COMPLETED',
  'MODEL_INVOCATION_FAILED',
  'MODEL_RATE_LIMITED',
  'MODEL_NOT_FOUND',

  // Administrative & Security
  'AUDIT_QUERY_PERFORMED',
  'AUDIT_ACCESS_DENIED',
  'INTEGRITY_VERIFICATION_FAILED'
];

const eventSchema = {
  type: 'object',
  required: ['eventType'],
  properties: {
    eventId: { type: 'string', maxLength: 128 },
    eventVersion: { type: 'integer', minimum: 1, maximum: 10 },
    eventType: { type: 'string', minLength: 3, maxLength: 100 },
    timestamp: { type: 'string' },
    occurredAt: { type: 'string' },
    organizationId: { type: 'string', minLength: 1, maxLength: 128 },
    sourceService: { type: 'string', maxLength: 100 },
    sourceEventId: { type: 'string', maxLength: 128 },
    requestId: { type: 'string', maxLength: 128 },
    traceId: { type: 'string', maxLength: 128 },
    callerId: { type: 'string', maxLength: 128 },
    severity: { type: 'string', enum: ALLOWED_SEVERITIES },
    outcome: { type: 'string', maxLength: 64 },
    action: { type: 'string', maxLength: 128 },
    reasonCode: { type: 'string', maxLength: 128 },
    details: { type: 'object' },
    metadata: { type: 'object' },
    correlationId: { type: 'string', maxLength: 128 }
  },
  additionalProperties: true
};

const validateEventCompiled = ajv.compile(eventSchema);

class EventValidationService {
  /**
   * Validates an incoming audit event payload against schema and business taxonomy.
   *
   * @param {object} event
   * @throws {BadRequestError} if payload is invalid
   */
  validateEvent(event) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      throw new BadRequestError('Event payload must be a non-null JSON object.');
    }

    const valid = validateEventCompiled(event);
    if (!valid) {
      const messages = validateEventCompiled.errors.map(
        (err) => `${err.instancePath ? err.instancePath + ' ' : ''}${err.message}`
      );
      throw new BadRequestError(`Invalid event payload: ${messages.join(', ')}`);
    }

    if (!ALLOWED_EVENT_TYPES.includes(event.eventType)) {
      throw new BadRequestError(
        `Unsupported eventType '${event.eventType}'. Permitted types: ${ALLOWED_EVENT_TYPES.slice(0, 10).join(', ')}...`
      );
    }
  }

  isSupportedEventType(eventType) {
    return ALLOWED_EVENT_TYPES.includes(eventType);
  }
}

const eventValidationService = new EventValidationService();

module.exports = {
  EventValidationService,
  eventValidationService,
  ALLOWED_EVENT_TYPES,
  ALLOWED_SEVERITIES
};
