// Integration Tests: Scanner Configuration & Custom Pattern Management

const request = require('supertest');
const { app } = require('../../src/app');
const { generateTestToken, testOrgId } = require('../fixtures/syntheticData');
const { scannerConfigRepository } = require('../../src/repositories/scannerConfig.repository');

describe('Scanner Configuration API Integration Tests', () => {
  let adminToken;

  beforeEach(() => {
    adminToken = generateTestToken({ organizationId: testOrgId });
    scannerConfigRepository.setForceInMemory(true);
    scannerConfigRepository.clear();
  });

  it('GET /v1/config/limitations should return transparent detection capabilities without auth', async () => {
    const res = await request(app).get('/v1/config/limitations');

    expect(res.status).toBe(200);
    expect(res.body.limitations).toBeInstanceOf(Array);
    expect(res.body.limitations.length).toBeGreaterThan(0);
    expect(res.body.limitations.some((l) => l.category === 'EMAIL')).toBe(true);
  });

  it('GET /v1/config should return organization scanner configuration', async () => {
    const res = await request(app)
      .get('/v1/config')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.config).toBeDefined();
    expect(res.body.config.organizationId).toBe(testOrgId);
    expect(res.body.supportedCategories).toContain('EMAIL');
    expect(res.body.supportedCategories).toContain('SECRET');
  });

  it('PUT /v1/config should update organization enabled categories', async () => {
    const res = await request(app)
      .put('/v1/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        organizationId: testOrgId,
        enabledCategories: ['EMAIL', 'PHONE'],
        ruleSetVersion: '1.1.0'
      });

    expect(res.status).toBe(200);
    expect(res.body.enabledCategories).toEqual(['EMAIL', 'PHONE']);
    expect(res.body.ruleSetVersion).toBe('1.1.0');
  });

  it('POST /v1/config/patterns should register a safe custom pattern rule', async () => {
    const res = await request(app)
      .post('/v1/config/patterns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        organizationId: testOrgId,
        name: 'Confidential Internal Codename',
        category: 'CODENAME',
        pattern: '\\bOperation\\s+Starlight\\b',
        severity: 'HIGH',
        action: 'REQUIRE_APPROVAL'
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Confidential Internal Codename');
    expect(res.body.pattern).toBe('\\bOperation\\s+Starlight\\b');
    expect(res.body.action).toBe('REQUIRE_APPROVAL');
  });

  it('SECURITY REGRESSION: rejects unsafe ReDoS pattern on custom pattern registration', async () => {
    const res = await request(app)
      .post('/v1/config/patterns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        organizationId: testOrgId,
        name: 'Vulnerable Pattern',
        pattern: '([a-zA-Z]+)+'
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(res.body.error.message).toContain('ReDoS');
  });
});
