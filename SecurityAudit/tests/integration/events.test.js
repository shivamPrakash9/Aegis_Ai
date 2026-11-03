// Integration Tests for POST /v1/events Ingestion API

const request = require('supertest');
const app = require('../../src/app');
const { tokenTenantA } = require('../fixtures/syntheticData');
const { auditEventRepository } = require('../../src/repositories/auditEvent.repository');

describe('POST /v1/events Ingestion API', () => {
  beforeEach(() => {
    auditEventRepository.clearInMemory();
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .post('/v1/events')
      .send({
        eventType: 'AI_REQUEST_ACCEPTED',
        organizationId: 'org_enterprise_alpha'
      });

    expect(res.status).toBe(401);
  });

  it('accepts and persists valid audit event with 201 Created', async () => {
    const res = await request(app)
      .post('/v1/events')
      .set('Authorization', `Bearer ${tokenTenantA}`)
      .send({
        eventType: 'AI_REQUEST_ACCEPTED',
        organizationId: 'org_enterprise_alpha',
        requestId: 'req_test_101',
        traceId: 'trace_test_202',
        severity: 'INFO',
        details: { model: 'mock-gpt-4', action: 'ALLOW' }
      });

    expect(res.status).toBe(201);
    expect(res.body.accepted).toBe(true);
    expect(res.body.eventId).toBeDefined();
    expect(res.body.status).toBe('PERSISTED');

    // Verify stored event in repository
    const stored = await auditEventRepository.findByEventId(
      res.body.eventId,
      'org_enterprise_alpha'
    );
    expect(stored).toBeDefined();
    expect(stored.eventType).toBe('AI_REQUEST_ACCEPTED');
    expect(stored.integrity).toBeDefined();
    expect(stored.integrity.digest).toBeDefined();
  });

  it('accepts internal service key authentication', async () => {
    const res = await request(app)
      .post('/v1/events')
      .set('X-Internal-Service-Key', 'aegis_internal_service_secret_key_dev')
      .send({
        eventType: 'AI_REQUEST_COMPLETED',
        organizationId: 'org_enterprise_alpha',
        requestId: 'req_internal_1',
        traceId: 'trace_internal_1',
        severity: 'INFO',
        details: { tokens: 120 }
      });

    expect(res.status).toBe(201);
    expect(res.body.accepted).toBe(true);
  });

  it('deduplicates identical event submissions with 200 OK and DUPLICATE status', async () => {
    const payload = {
      eventId: 'evt_fixed_id_123',
      eventType: 'AI_REQUEST_COMPLETED',
      organizationId: 'org_enterprise_alpha',
      requestId: 'req_dedup_1',
      traceId: 'trace_dedup_1',
      severity: 'INFO',
      details: { tokens: 50 }
    };

    // First emission
    const res1 = await request(app)
      .post('/v1/events')
      .set('Authorization', `Bearer ${tokenTenantA}`)
      .send(payload);

    expect(res1.status).toBe(201);
    expect(res1.body.status).toBe('PERSISTED');

    // Duplicate emission
    const res2 = await request(app)
      .post('/v1/events')
      .set('Authorization', `Bearer ${tokenTenantA}`)
      .send(payload);

    expect(res2.status).toBe(200);
    expect(res2.body.accepted).toBe(true);
    expect(res2.body.status).toBe('DUPLICATE');
    expect(res2.body.eventId).toBe('evt_fixed_id_123');
  });

  it('sanitizes raw prompt and secret keys prior to persistence', async () => {
    const res = await request(app)
      .post('/v1/events')
      .set('Authorization', `Bearer ${tokenTenantA}`)
      .send({
        eventType: 'AI_REQUEST_RECEIVED',
        organizationId: 'org_enterprise_alpha',
        requestId: 'req_secret_test',
        traceId: 'trace_secret_test',
        severity: 'INFO',
        details: {
          prompt: 'Raw user prompt that should never be stored',
          apiKey: 'sk-proj-super-secret-key-12345',
          safeModelName: 'mock-gpt-4'
        }
      });

    expect(res.status).toBe(201);

    const stored = await auditEventRepository.findByEventId(
      res.body.eventId,
      'org_enterprise_alpha'
    );
    expect(stored.details.prompt).toBe('[REDACTED_SENSITIVE_DATA]');
    expect(stored.details.apiKey).toBe('[REDACTED_SENSITIVE_DATA]');
    expect(stored.details.safeModelName).toBe('mock-gpt-4');
  });

  it('rejects unsupported eventType with 400 Bad Request', async () => {
    const res = await request(app)
      .post('/v1/events')
      .set('Authorization', `Bearer ${tokenTenantA}`)
      .send({
        eventType: 'INVALID_EVENT_TYPE_123',
        organizationId: 'org_enterprise_alpha'
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});
