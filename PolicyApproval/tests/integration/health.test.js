// Integration Tests: Health Endpoints (/health/live, /health/ready)

const request = require('supertest');
const { app } = require('../../src/app');

describe('Health Probe Endpoints', () => {
  test('GET /health/live returns 200 and UP status', async () => {
    const res = await request(app).get('/health/live');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
    expect(res.body.service).toBe('PolicyApproval');
    expect(res.body.timestamp).toBeDefined();
  });

  test('GET /health/ready returns service readiness status and dependency checks', async () => {
    const res = await request(app).get('/health/ready');

    // Either 200 (READY) or 503 (DEGRADED if DB offline in local test runner)
    expect([200, 503]).toContain(res.status);
    expect(['READY', 'DEGRADED']).toContain(res.body.status);
    expect(res.body.service).toBe('PolicyApproval');
    expect(res.body.dependencies).toBeDefined();
  });
});
