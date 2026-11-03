// Unit Tests for Cryptographic Integrity Service

const { integrityService } = require('../../src/services/integrity.service');

describe('Cryptographic Integrity Service', () => {
  it('produces deterministic canonical JSON string regardless of key ordering', () => {
    const obj1 = { b: 2, a: 1, c: { y: 20, x: 10 } };
    const obj2 = { a: 1, c: { x: 10, y: 20 }, b: 2 };

    const canonical1 = integrityService.canonicalJson(obj1);
    const canonical2 = integrityService.canonicalJson(obj2);

    expect(canonical1).toBe(canonical2);
    expect(canonical1).toBe('{"a":1,"b":2,"c":{"x":10,"y":20}}');
  });

  it('calculates deterministic SHA-256 digest over canonical event string', () => {
    const event = {
      eventId: 'evt_test_1',
      eventVersion: 1,
      eventType: 'AI_REQUEST_ACCEPTED',
      occurredAt: '2026-10-21T00:00:00.000Z',
      organizationId: 'org_test',
      sourceService: 'ai-gateway',
      requestId: 'req_123',
      traceId: 'trace_456',
      severity: 'INFO',
      details: { model: 'mock-gpt-4', tokens: 100 }
    };

    const result1 = integrityService.calculateDigest(event);
    const result2 = integrityService.calculateDigest(event);

    expect(result1.digest).toBe(result2.digest);
    expect(result1.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(result1.algorithm).toBe('sha256');
  });

  it('successfully verifies untampered event', () => {
    const event = {
      eventId: 'evt_test_2',
      eventVersion: 1,
      eventType: 'AI_REQUEST_COMPLETED',
      occurredAt: '2026-10-21T00:00:00.000Z',
      organizationId: 'org_test',
      sourceService: 'ai-gateway',
      requestId: 'req_123',
      traceId: 'trace_456',
      severity: 'INFO',
      details: { tokens: 50 }
    };

    const { digest } = integrityService.calculateDigest(event);
    event.integrity = { digest, algorithm: 'sha256' };

    const verification = integrityService.verifyIntegrity(event);
    expect(verification.valid).toBe(true);
    expect(verification.reason).toBe('Verified');
  });

  it('detects tampering when payload details are modified', () => {
    const event = {
      eventId: 'evt_test_3',
      eventVersion: 1,
      eventType: 'AI_REQUEST_COMPLETED',
      occurredAt: '2026-10-21T00:00:00.000Z',
      organizationId: 'org_test',
      sourceService: 'ai-gateway',
      requestId: 'req_123',
      traceId: 'trace_456',
      severity: 'INFO',
      details: { tokens: 50 }
    };

    const { digest } = integrityService.calculateDigest(event);
    event.integrity = { digest, algorithm: 'sha256' };

    // Tamper with event details
    event.details.tokens = 999999;

    const verification = integrityService.verifyIntegrity(event);
    expect(verification.valid).toBe(false);
    expect(verification.reason).toContain('Tamper detected');
  });

  it('detects tampering when severity is altered', () => {
    const event = {
      eventId: 'evt_test_4',
      eventVersion: 1,
      eventType: 'AI_REQUEST_FAILED',
      occurredAt: '2026-10-21T00:00:00.000Z',
      organizationId: 'org_test',
      sourceService: 'ai-gateway',
      requestId: 'req_123',
      traceId: 'trace_456',
      severity: 'CRITICAL',
      details: { error: 'Violation' }
    };

    const { digest } = integrityService.calculateDigest(event);
    event.integrity = { digest, algorithm: 'sha256' };

    // Tamper with severity to downgrade alert
    event.severity = 'INFO';

    const verification = integrityService.verifyIntegrity(event);
    expect(verification.valid).toBe(false);
  });
});
