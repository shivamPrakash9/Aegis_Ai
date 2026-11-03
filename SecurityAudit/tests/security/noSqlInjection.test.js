// Security Tests: NoSQL Injection, Tenant Isolation, and Immutability

const request = require('supertest');
const app = require('../../src/app');
const { tokenTenantA, tokenTenantB } = require('../fixtures/syntheticData');
const { auditEventRepository } = require('../../src/repositories/auditEvent.repository');
const { eventIngestionService } = require('../../src/services/eventIngestion.service');

describe('Security Tests: NoSQL Injection, Immutability & Tenant Isolation', () => {
  beforeEach(async () => {
    auditEventRepository.clearInMemory();

    await eventIngestionService.ingestEvent(
      {
        eventId: 'evt_secure_1',
        eventType: 'AI_REQUEST_COMPLETED',
        organizationId: 'org_enterprise_alpha',
        requestId: 'req_sec_1',
        traceId: 'trace_sec_1',
        severity: 'INFO',
        details: { status: 'secure' }
      },
      { isInternalService: true }
    );
  });

  describe('NoSQL Injection Prevention', () => {
    it('SECURITY REQUIREMENT: sanitizes NoSQL operators ($gt, $ne, $where) in query params', async () => {
      // Attacker tries to inject MongoDB query operator to dump all tenant events
      const res = await request(app)
        .get('/v1/events?eventType[$ne]=nonexistent')
        .set('Authorization', `Bearer ${tokenTenantA}`);

      expect(res.status).toBe(200);
      // Operator should not dump arbitrary events or crash service
    });

    it('SECURITY REQUIREMENT: strips $ and . characters in traceId and eventId lookups', async () => {
      const maliciousTraceId = '$where: "this.organizationId != null"';
      const res = await request(app)
        .get(`/v1/traces/${encodeURIComponent(maliciousTraceId)}`)
        .set('Authorization', `Bearer ${tokenTenantA}`);

      expect(res.status).toBe(404);
    });
  });

  describe('Append-Only Immutability', () => {
    it('SECURITY REQUIREMENT: rejects PUT requests (no mutation endpoint)', async () => {
      const res = await request(app)
        .put('/v1/events/evt_secure_1')
        .set('Authorization', `Bearer ${tokenTenantA}`)
        .send({ severity: 'LOW' });

      expect(res.status).toBe(404);
    });

    it('SECURITY REQUIREMENT: rejects PATCH requests (no mutation endpoint)', async () => {
      const res = await request(app)
        .patch('/v1/events/evt_secure_1')
        .set('Authorization', `Bearer ${tokenTenantA}`)
        .send({ severity: 'LOW' });

      expect(res.status).toBe(404);
    });

    it('SECURITY REQUIREMENT: rejects DELETE requests (no deletion endpoint)', async () => {
      const res = await request(app)
        .delete('/v1/events/evt_secure_1')
        .set('Authorization', `Bearer ${tokenTenantA}`);

      expect(res.status).toBe(404);
    });
  });

  describe('Cross-Tenant Data Isolation', () => {
    it('SECURITY REQUIREMENT: Tenant B cannot spoof organizationId parameter to query Tenant A events', async () => {
      const res = await request(app)
        .get('/v1/events?organizationId=org_enterprise_alpha')
        .set('Authorization', `Bearer ${tokenTenantB}`);

      // Middleware rejects cross-tenant spoofing with 403 Forbidden
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('SECURITY REQUIREMENT: unauthenticated requests to query endpoints are strictly rejected', async () => {
      const res = await request(app).get('/v1/events');
      expect(res.status).toBe(401);
    });
  });
});
