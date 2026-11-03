// Integration Tests for Health Endpoints

const request = require('supertest');
const app = require('../../src/app');

describe('Health Endpoints', () => {
  it('GET /health/live returns 200 with service status', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
    expect(res.body.service).toBe('SecurityAudit');
    expect(res.body.timestamp).toBeDefined();
  });

  it('GET /health/ready returns 200 with database readiness status', async () => {
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('SecurityAudit');
    expect(res.body.dependencies).toBeDefined();
    expect(res.body.dependencies.database.type).toBe('MongoDB');
  });
});
