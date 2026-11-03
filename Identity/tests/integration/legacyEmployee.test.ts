// Integration tests for Legacy Employee SOAP client, Circuit Breaker, and REST endpoint
// Conforms to Web Services Assignment:
// - Requirement 6: ETag
// - Requirement 7: Content negotiation (JSON and XML)
// - Requirement 16: Circuit Breaker
// - Requirement 23: WSDL & SOAP
// - Requirement 24: Exponential backoff retry

import request from 'supertest';
import { app } from '../../src/app';
import { legacyEmployeeClient, LegacyEmployeeClient } from '../../src/integrations/soap/legacyEmployeeClient';

describe('Legacy Employee SOAP Integration & Circuit Breaker', () => {
  beforeEach(() => {
    legacyEmployeeClient.resetBreaker();
  });

  describe('GET /v1/legacy-employees/:employeeId', () => {
    it('successfully queries legacy SOAP service for valid employee E1001', async () => {
      const res = await request(app)
        .get('/v1/legacy-employees/E1001')
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('exists', true);
      expect(res.body).toHaveProperty('employeeId', 'E1001');
      expect(res.body).toHaveProperty('fullName');
      expect(res.headers['cache-control']).toBeDefined();
      expect(res.headers['etag']).toBeDefined();
    });

    it('returns 404 when legacy employee does not exist in SOAP directory', async () => {
      const res = await request(app)
        .get('/v1/legacy-employees/NON_EXISTENT_999')
        .set('Accept', 'application/json');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('supports XML content negotiation on legacy employee endpoint', async () => {
      const res = await request(app)
        .get('/v1/legacy-employees/E1001')
        .set('Accept', 'application/xml');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/xml');
      expect(res.text).toContain('<response>');
      expect(res.text).toContain('<employeeId>E1001</employeeId>');
    });

    it('returns 406 when unsupported Accept header is requested', async () => {
      const res = await request(app)
        .get('/v1/legacy-employees/E1001')
        .set('Accept', 'application/x-custom-protobuf');

      expect(res.status).toBe(406);
      expect(res.body.error.code).toBe('NOT_ACCEPTABLE');
    });

    it('supports ETag caching with 304 response on /openapi.json', async () => {
      const initial = await request(app).get('/openapi.json');
      expect(initial.status).toBe(200);
      const etag = initial.headers['etag'];
      expect(etag).toBeDefined();

      const conditional = await request(app)
        .get('/openapi.json')
        .set('If-None-Match', etag);

      expect(conditional.status).toBe(304);
      expect(conditional.text).toBe('');
    });
  });

  describe('Circuit Breaker Unit Behavior', () => {
    it('transitions to OPEN after threshold consecutive failures and rejects immediately', async () => {
      const breakerClient = new LegacyEmployeeClient();

      expect(breakerClient.getCircuitState()).toBe('CLOSED');

      // Mock executeSoapCall to simulate downstream network failure
      jest.spyOn(breakerClient as any, 'executeSoapCall').mockRejectedValue(
        new Error('Downstream network connection timeout')
      );

      // Attempt calls to trip circuit breaker (threshold is 5)
      for (let i = 0; i < 5; i++) {
        try {
          await breakerClient.checkEmployee('E1001');
        } catch {
          // Expected failure
        }
      }

      expect(breakerClient.getCircuitState()).toBe('OPEN');

      // Next immediate call should be rejected with Circuit Breaker OPEN without attempting network
      await expect(breakerClient.checkEmployee('E1001')).rejects.toThrow(
        /Circuit breaker is OPEN/
      );
    });
  });
});
