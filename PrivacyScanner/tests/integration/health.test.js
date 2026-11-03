// Integration Tests: Health Probes

const request = require('supertest');
const { app } = require('../../src/app');

describe('Health API Integration Tests', () => {
  it('GET /health/live should return 200 with status UP', async () => {
    const res = await request(app).get('/health/live');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
    expect(res.body.service).toBe('PrivacyScanner');
    expect(res.body.timestamp).toBeDefined();
  });

  it('GET /health/ready should report dependency readiness without leaking database credentials', async () => {
    const res = await request(app).get('/health/ready');

    // Either 200 (if DB active) or 503 (if DB offline in unit test environment)
    expect([200, 503]).toContain(res.status);
    expect(res.body.service).toBe('PrivacyScanner');
    expect(res.body.dependencies).toBeDefined();

    // Verify ZERO credentials leaked in body
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain('password');
    expect(bodyStr).not.toContain('postgres');
    expect(bodyStr).not.toContain('5432');
  });
});
