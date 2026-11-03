// Integration Tests: Privacy Scan Operations & Gateway Compatibility

const request = require('supertest');
const { app } = require('../../src/app');
const { generateTestToken, testOrgId } = require('../fixtures/syntheticData');
const { scannerConfigRepository } = require('../../src/repositories/scannerConfig.repository');
const { scanMetadataRepository } = require('../../src/repositories/scanMetadata.repository');

describe('Privacy Scan API Integration Tests', () => {
  let validToken;

  beforeEach(() => {
    validToken = generateTestToken({ organizationId: testOrgId });
    scannerConfigRepository.setForceInMemory(true);
    scanMetadataRepository.setForceInMemory(true);
    scannerConfigRepository.clear();
    scanMetadataRepository.clear();
  });

  describe('Happy Path & PII Detection', () => {
    it('should return ALLOW with unchanged messages when no sensitive content exists', async () => {
      const payload = {
        organizationId: testOrgId,
        messages: [
          { role: 'user', content: 'Explain architectural patterns for microservices.' }
        ]
      };

      const res = await request(app)
        .post('/v1/scan')
        .set('Authorization', `Bearer ${validToken}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.action).toBe('ALLOW');
      expect(res.body.decision).toBe('ALLOW');
      expect(res.body.findings).toHaveLength(0);
      expect(res.body.sanitizedMessages[0].content).toBe(payload.messages[0].content);
      expect(res.body.scanId).toMatch(/^scan_/);
    });

    it('should detect email and return MASK decision with sanitized content', async () => {
      const payload = {
        organizationId: testOrgId,
        messages: [
          { role: 'user', content: 'Contact me at alice.smith@example.com for documentation.' }
        ]
      };

      const res = await request(app)
        .post('/v1/scan')
        .set('Authorization', `Bearer ${validToken}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.action).toBe('MASK');
      expect(res.body.decision).toBe('MASK');
      expect(res.body.findings).toHaveLength(1);
      expect(res.body.findings[0].category).toBe('EMAIL');
      expect(res.body.findings[0].replacementToken).toBe('[EMAIL_1]');
      expect(res.body.sanitizedMessages[0].content).toBe('Contact me at [EMAIL_1] for documentation.');

      // SECURITY: Finding must NOT leak raw matched value
      expect(res.body.findings[0]).not.toHaveProperty('matchedText');
    });

    it('should mask multiple distinct sensitive entities with distinct tokens', async () => {
      const payload = {
        organizationId: testOrgId,
        messages: [
          {
            role: 'user',
            content: 'User alice@example.com with phone 555-0199 and PAN ABCDE1234F submitted form.'
          }
        ]
      };

      const res = await request(app)
        .post('/v1/scan')
        .set('Authorization', `Bearer ${validToken}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.action).toBe('MASK');
      expect(res.body.findings.length).toBeGreaterThanOrEqual(3);
      expect(res.body.sanitizedMessages[0].content).toContain('[EMAIL_1]');
      expect(res.body.sanitizedMessages[0].content).toContain('[PHONE_1]');
      expect(res.body.sanitizedMessages[0].content).toContain('[PAN_1]');
    });
  });

  describe('High-Risk Secret Detection & Gating', () => {
    it('SECURITY REQUIREMENT: AWS Access Key ID returns BLOCK decision and empty sanitized messages', async () => {
      const payload = {
        organizationId: testOrgId,
        messages: [
          { role: 'user', content: 'Here is AWS key AKIAIOSFODNN7EXAMPLE to test bucket access.' }
        ]
      };

      const res = await request(app)
        .post('/v1/scan')
        .set('Authorization', `Bearer ${validToken}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.action).toBe('BLOCK');
      expect(res.body.decision).toBe('BLOCK');
      expect(res.body.sanitizedMessages).toHaveLength(0); // Security enforcement
      expect(res.body.findings.some((f) => f.category === 'SECRET')).toBe(true);

      // Verify ZERO raw secrets in response
      const responseStr = JSON.stringify(res.body);
      expect(responseStr).not.toContain('AKIAIOSFODNN7EXAMPLE');
    });

    it('SECURITY REQUIREMENT: Credential assignment (password=...) returns BLOCK decision', async () => {
      const payload = {
        organizationId: testOrgId,
        messages: [
          { role: 'user', content: 'Database config: password=SuperSecretPassword123! and host=localhost' }
        ]
      };

      const res = await request(app)
        .post('/v1/scan')
        .set('Authorization', `Bearer ${validToken}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.action).toBe('BLOCK');
      expect(res.body.findings.some((f) => f.category === 'CREDENTIAL_ASSIGNMENT')).toBe(true);

      // Verify raw secret password not leaked in response
      const responseStr = JSON.stringify(res.body);
      expect(responseStr).not.toContain('SuperSecretPassword123!');
    });
  });

  describe('Validation & Error Scenarios', () => {
    it('should reject payload missing messages with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/v1/scan')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ organizationId: testOrgId });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.correlationId).toBeDefined();
    });

    it('should reject unauthenticated request with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/v1/scan')
        .send({
          organizationId: testOrgId,
          messages: [{ role: 'user', content: 'Hello' }]
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
