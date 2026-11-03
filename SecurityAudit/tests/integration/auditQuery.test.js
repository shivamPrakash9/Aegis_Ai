// Integration Tests for Audit Query and Investigation APIs

const request = require('supertest');
const app = require('../../src/app');
const { tokenTenantA, tokenTenantB, tokenAuditor } = require('../fixtures/syntheticData');
const { auditEventRepository } = require('../../src/repositories/auditEvent.repository');
const { eventIngestionService } = require('../../src/services/eventIngestion.service');

describe('Audit Query and Investigation APIs', () => {
  beforeEach(async () => {
    auditEventRepository.clearInMemory();

    // Ingest events for Tenant A
    await eventIngestionService.ingestEvent(
      {
        eventId: 'evt_a_1',
        eventType: 'AI_REQUEST_ACCEPTED',
        organizationId: 'org_enterprise_alpha',
        requestId: 'req_alpha_1',
        traceId: 'trace_alpha_100',
        severity: 'INFO',
        details: { step: 'accepted' }
      },
      { isInternalService: true }
    );

    await eventIngestionService.ingestEvent(
      {
        eventId: 'evt_a_2',
        eventType: 'AI_REQUEST_COMPLETED',
        organizationId: 'org_enterprise_alpha',
        requestId: 'req_alpha_1',
        traceId: 'trace_alpha_100',
        severity: 'INFO',
        details: { step: 'completed', tokens: 42 }
      },
      { isInternalService: true }
    );

    // Ingest event for Tenant B
    await eventIngestionService.ingestEvent(
      {
        eventId: 'evt_b_1',
        eventType: 'AI_REQUEST_ACCEPTED',
        organizationId: 'org_enterprise_beta',
        requestId: 'req_beta_1',
        traceId: 'trace_beta_200',
        severity: 'INFO',
        details: { step: 'accepted_b' }
      },
      { isInternalService: true }
    );
  });

  describe('GET /v1/traces/:traceId', () => {
    it('returns trace events for caller organization', async () => {
      const res = await request(app)
        .get('/v1/traces/trace_alpha_100')
        .set('Authorization', `Bearer ${tokenTenantA}`);

      expect(res.status).toBe(200);
      expect(res.body.traceId).toBe('trace_alpha_100');
      expect(res.body.requestId).toBe('req_alpha_1');
      expect(res.body.events).toHaveLength(2);
      expect(res.body.events[0].eventType).toBe('AI_REQUEST_ACCEPTED');
      expect(res.body.events[1].eventType).toBe('AI_REQUEST_COMPLETED');
    });

    it('returns 404 when traceId does not exist in caller organization', async () => {
      const res = await request(app)
        .get('/v1/traces/trace_nonexistent')
        .set('Authorization', `Bearer ${tokenTenantA}`);

      expect(res.status).toBe(404);
    });

    it('TENANT ISOLATION: Tenant B receives 404 when querying Tenant A traceId', async () => {
      const res = await request(app)
        .get('/v1/traces/trace_alpha_100')
        .set('Authorization', `Bearer ${tokenTenantB}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /v1/events/:eventId', () => {
    it('retrieves single event by ID', async () => {
      const res = await request(app)
        .get('/v1/events/evt_a_1')
        .set('Authorization', `Bearer ${tokenTenantA}`);

      expect(res.status).toBe(200);
      expect(res.body.eventId).toBe('evt_a_1');
      expect(res.body.organizationId).toBe('org_enterprise_alpha');
    });

    it('TENANT ISOLATION: Tenant B cannot retrieve Tenant A event by ID', async () => {
      const res = await request(app)
        .get('/v1/events/evt_a_1')
        .set('Authorization', `Bearer ${tokenTenantB}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /v1/events/:eventId/verify', () => {
    it('cryptographically verifies untampered event digest', async () => {
      const res = await request(app)
        .get('/v1/events/evt_a_1/verify')
        .set('Authorization', `Bearer ${tokenAuditor}`);

      expect(res.status).toBe(200);
      expect(res.body.verified).toBe(true);
      expect(res.body.digest).toBeDefined();
      expect(res.body.algorithm).toBe('sha256');
    });
  });

  describe('GET /v1/requests/:requestId/events', () => {
    it('retrieves all events for a given requestId', async () => {
      const res = await request(app)
        .get('/v1/requests/req_alpha_1/events')
        .set('Authorization', `Bearer ${tokenTenantA}`);

      expect(res.status).toBe(200);
      expect(res.body.requestId).toBe('req_alpha_1');
      expect(res.body.events).toHaveLength(2);
    });
  });

  describe('GET /v1/events', () => {
    it('searches events with pagination and filters', async () => {
      const res = await request(app)
        .get('/v1/events?eventType=AI_REQUEST_COMPLETED&page=1&limit=10')
        .set('Authorization', `Bearer ${tokenTenantA}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].eventId).toBe('evt_a_2');
      expect(res.body.pagination.total).toBe(1);
    });
  });
});
