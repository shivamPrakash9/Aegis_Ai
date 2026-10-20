// Integration Tests: Multi-Tenant Isolation & Authorization

const request = require('supertest');
const { app } = require('../../src/app');
const { generateTestToken, testOrgId, testOrgIdBeta } = require('../fixtures/syntheticData');
const { scannerConfigRepository } = require('../../src/repositories/scannerConfig.repository');

describe('Multi-Tenant Isolation Security Tests', () => {
  let tokenOrgAlpha;
  let tokenOrgBeta;

  beforeEach(() => {
    tokenOrgAlpha = generateTestToken({ organizationId: testOrgId });
    tokenOrgBeta = generateTestToken({ organizationId: testOrgIdBeta });
    scannerConfigRepository.setForceInMemory(true);
    scannerConfigRepository.clear();
  });

  it('SECURITY REGRESSION: rejects cross-tenant scan request where token organization does not match request organization', async () => {
    // Caller with Org Beta token submits a scan under Org Alpha
    const res = await request(app)
      .post('/v1/scan')
      .set('Authorization', `Bearer ${tokenOrgBeta}`)
      .send({
        organizationId: testOrgId, // Org Alpha
        messages: [{ role: 'user', content: 'Cross-tenant probe' }]
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toContain('Cross-tenant access rejected');
  });

  it('SECURITY REGRESSION: tenant cannot modify another tenant scanner configuration', async () => {
    const res = await request(app)
      .put('/v1/config')
      .set('Authorization', `Bearer ${tokenOrgBeta}`)
      .send({
        organizationId: testOrgId, // Attempting to alter Org Alpha config
        enabledCategories: ['EMAIL']
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('SECURITY REGRESSION: custom pattern rules are isolated per organization', async () => {
    // Add custom pattern for Org Alpha
    await request(app)
      .post('/v1/config/patterns')
      .set('Authorization', `Bearer ${tokenOrgAlpha}`)
      .send({
        organizationId: testOrgId,
        name: 'Alpha Secret Keyword',
        pattern: '\\bAlphaKeyword123\\b',
        action: 'BLOCK'
      });

    // Scan under Org Alpha triggers rule
    const alphaRes = await request(app)
      .post('/v1/scan')
      .set('Authorization', `Bearer ${tokenOrgAlpha}`)
      .send({
        organizationId: testOrgId,
        messages: [{ role: 'user', content: 'Testing AlphaKeyword123 here.' }]
      });

    expect(alphaRes.status).toBe(200);
    expect(alphaRes.body.action).toBe('BLOCK');

    // Scan under Org Beta should NOT trigger Org Alpha's rule
    const betaRes = await request(app)
      .post('/v1/scan')
      .set('Authorization', `Bearer ${tokenOrgBeta}`)
      .send({
        organizationId: testOrgIdBeta,
        messages: [{ role: 'user', content: 'Testing AlphaKeyword123 here.' }]
      });

    expect(betaRes.status).toBe(200);
    expect(betaRes.body.action).toBe('ALLOW'); // Org Alpha rule does not leak into Org Beta!
  });
});
