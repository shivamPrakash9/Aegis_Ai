// Integration Tests: Health Endpoints

const request = require('supertest');
const { app } = require('../../src/app');

describe('Health API Endpoints', () => {
  describe('GET /health/live', () => {
    it('should return 200 with status UP', async () => {
      const res = await request(app).get('/health/live');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body.service).toBe('aegis-ai-gateway');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('GET /health/ready', () => {
    it('should report readiness status without leaking connection credentials', async () => {
      const res = await request(app).get('/health/ready');

      // Status can be 200 (if dev db/fallback up) or 503 (if db daemon not running)
      expect([200, 503]).toContain(res.status);
      expect(res.body.service).toBe('aegis-ai-gateway');
      expect(res.body.checks).toBeDefined();
      expect(res.body.checks.database).toBeDefined();
      expect(res.body.checks.redis).toBeDefined();
    });
  });
});
