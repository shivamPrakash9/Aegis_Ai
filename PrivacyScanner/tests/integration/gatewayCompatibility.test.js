// Integration Tests: Real Gateway Client Compatibility

const http = require('http');
const { app } = require('../../src/app');
const { PrivacyScannerClient } = require('../../../AIGateway/src/clients/privacyScannerClient');
const { privacyEnforcementService } = require('../../../AIGateway/src/services/privacyEnforcement.service');
const { testOrgId } = require('../fixtures/syntheticData');
const { scannerConfigRepository } = require('../../src/repositories/scannerConfig.repository');
const { scanMetadataRepository } = require('../../src/repositories/scanMetadata.repository');

describe('Gateway Client End-to-End Compatibility Tests', () => {
  let server;
  let client;

  beforeAll((done) => {
    scannerConfigRepository.setForceInMemory(true);
    scanMetadataRepository.setForceInMemory(true);

    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const baseUrl = `http://127.0.0.1:${port}`;
      client = new PrivacyScannerClient(baseUrl);
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  it('SECURITY COMPATIBILITY: Gateway client ALLOW response processed cleanly by privacyEnforcementService', async () => {
    const messages = [
      { role: 'user', content: 'What is public key cryptography?' }
    ];

    const result = await client.scan({
      messages,
      organizationId: testOrgId,
      correlationId: 'test-gateway-corr-1'
    });

    expect(result).toBeDefined();
    expect(result.action).toBe('ALLOW');
    expect(result.sanitizedMessages).toBeDefined();

    // Verify AI Gateway's PrivacyEnforcementService accepts this payload without error
    const enforcement = privacyEnforcementService.enforceScanAction({
      action: result.action,
      originalMessages: messages,
      sanitizedMessages: result.sanitizedMessages,
      routingConstraints: result.routingConstraints,
      findings: result.findings
    });

    expect(enforcement.proceedWithInvocation).toBe(true);
    expect(enforcement.effectiveMessages).toEqual(messages);
  });

  it('SECURITY COMPATIBILITY: Gateway client MASK response processed cleanly by privacyEnforcementService', async () => {
    const messages = [
      { role: 'user', content: 'Contact john.doe@example.com for access credentials.' }
    ];

    const result = await client.scan({
      messages,
      organizationId: testOrgId,
      correlationId: 'test-gateway-corr-2'
    });

    expect(result.action).toBe('MASK');
    expect(result.sanitizedMessages[0].content).toBe('Contact [EMAIL_1] for access credentials.');

    // Enforce in Gateway
    const enforcement = privacyEnforcementService.enforceScanAction({
      action: result.action,
      originalMessages: messages,
      sanitizedMessages: result.sanitizedMessages,
      routingConstraints: result.routingConstraints,
      findings: result.findings
    });

    expect(enforcement.proceedWithInvocation).toBe(true);
    expect(enforcement.effectiveMessages[0].content).toBe('Contact [EMAIL_1] for access credentials.');
  });

  it('SECURITY COMPATIBILITY: Gateway client BLOCK response stops model invocation in Gateway', async () => {
    const messages = [
      { role: 'user', content: 'AWS credentials: AKIAIOSFODNN7EXAMPLE' }
    ];

    const result = await client.scan({
      messages,
      organizationId: testOrgId,
      correlationId: 'test-gateway-corr-3'
    });

    expect(result.action).toBe('BLOCK');

    // Enforce in Gateway
    const enforcement = privacyEnforcementService.enforceScanAction({
      action: result.action,
      originalMessages: messages,
      sanitizedMessages: result.sanitizedMessages,
      routingConstraints: result.routingConstraints,
      findings: result.findings
    });

    expect(enforcement.proceedWithInvocation).toBe(false);
    expect(enforcement.finalStatus).toBe('BLOCKED');
  });
});
