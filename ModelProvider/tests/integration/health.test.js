// Integration Tests: Health Endpoints (/health/live, /health/ready)

const request = require('supertest');
const { app } = require('../../src/app');

describe('Health Probe Endpoints', () => {
  test('GET /health/live returns 200 and UP status', async () => {
    const res = await request(app).get('/health/live');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
    expect(res.body.service).toBe('ModelProvider');
    expect(res.body.timestamp).toBeDefined();
  });

  test('GET /health/ready returns service readiness status and dependency checks', async () => {
    const res = await request(app).get('/health/ready');

    expect([200, 503]).toContain(res.status);
    expect(['READY', 'DEGRADED']).toContain(res.body.status);
    expect(res.body.service).toBe('ModelProvider');
    expect(res.body.dependencies).toBeDefined();
  });
});
