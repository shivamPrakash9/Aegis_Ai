// Unit Tests for Event Validation Service

const { eventValidationService } = require('../../src/services/eventValidation.service');
const { BadRequestError } = require('../../src/utils/errors');

describe('Event Validation Service', () => {
  it('accepts valid audit event payload', () => {
    const validEvent = {
      eventType: 'AI_REQUEST_ACCEPTED',
      eventVersion: 1,
      organizationId: 'org_test',
      sourceService: 'ai-gateway',
      requestId: 'req_123',
      traceId: 'trace_456',
      severity: 'INFO',
      details: { model: 'mock-gpt-4' }
    };

    expect(() => eventValidationService.validateEvent(validEvent)).not.toThrow();
  });

  it('rejects non-object or null payloads', () => {
    expect(() => eventValidationService.validateEvent(null)).toThrow(BadRequestError);
    expect(() => eventValidationService.validateEvent('invalid')).toThrow(BadRequestError);
    expect(() => eventValidationService.validateEvent([])).toThrow(BadRequestError);
  });

  it('rejects event without eventType', () => {
    expect(() =>
      eventValidationService.validateEvent({
        organizationId: 'org_test'
      })
    ).toThrow(BadRequestError);
  });

  it('rejects unsupported eventType', () => {
    expect(() =>
      eventValidationService.validateEvent({
        eventType: 'UNSUPPORTED_RANDOM_ACTION',
        organizationId: 'org_test'
      })
    ).toThrow(BadRequestError);
  });

  it('rejects invalid severity value', () => {
    expect(() =>
      eventValidationService.validateEvent({
        eventType: 'AI_REQUEST_ACCEPTED',
        severity: 'SUPER_URGENT'
      })
    ).toThrow(BadRequestError);
  });

  it('isSupportedEventType returns correct boolean status', () => {
    expect(eventValidationService.isSupportedEventType('AI_REQUEST_COMPLETED')).toBe(true);
    expect(eventValidationService.isSupportedEventType('RANDOM_NOT_A_TYPE')).toBe(false);
  });
});
