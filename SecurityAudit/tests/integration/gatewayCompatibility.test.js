// AI Gateway SecurityAuditClient Compatibility Contract Tests

const http = require('http');
const app = require('../../src/app');
const { SecurityAuditClient } = require('../../../AIGateway/src/clients/securityAuditClient');
const { auditEventRepository } = require('../../src/repositories/auditEvent.repository');
const { NotFoundError } = require('../../../AIGateway/src/utils/errors');

describe('AI Gateway SecurityAuditClient Compatibility Contract', () => {
  let server;
  let client;
  let testPort;

  beforeAll((done) => {
    server = http.createServer(app);
    server.listen(0, () => {
      testPort = server.address().port;
      client = new SecurityAuditClient(`http://localhost:${testPort}`);
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    auditEventRepository.clearInMemory();
    client.resetMocks();
  });

  it('Gateway client emits security event to POST /v1/events seamlessly', async () => {
    const traceId = 'trace_gateway_contract_1';
    const requestId = 'req_gateway_contract_1';
    const organizationId = 'org_enterprise_alpha';

    await client.emitSecurityEvent({
      eventType: 'AI_REQUEST_ACCEPTED',
      traceId,
      requestId,
      organizationId,
      callerId: 'user_dev_1',
      severity: 'INFO',
      details: { step: 'pipeline_started' },
      correlationId: 'corr_test_gw_1'
    });

    // Verify stored event in SecurityAudit repository
    const traceData = await client.getTrace(traceId, organizationId, 'corr_test_gw_1');
    expect(traceData).toBeDefined();
    expect(traceData.traceId).toBe(traceId);
    expect(traceData.requestId).toBe(requestId);
    expect(traceData.events).toHaveLength(1);
    expect(traceData.events[0].eventType).toBe('AI_REQUEST_ACCEPTED');
    expect(traceData.events[0].details.step).toBe('pipeline_started');
  });

  it('Gateway client retrieves full request lifecycle trace across multiple emissions', async () => {
    const traceId = 'trace_lifecycle_100';
    const requestId = 'req_lifecycle_100';
    const organizationId = 'org_enterprise_alpha';

    // 1. Accepted
    await client.emitSecurityEvent({
      eventType: 'AI_REQUEST_ACCEPTED',
      traceId,
      requestId,
      organizationId,
      callerId: 'user_dev_1',
      severity: 'INFO',
      details: { step: 'accepted' },
      correlationId: 'corr_1'
    });

    // 2. Completed
    await client.emitSecurityEvent({
      eventType: 'AI_REQUEST_COMPLETED',
      traceId,
      requestId,
      organizationId,
      callerId: 'user_dev_1',
      severity: 'INFO',
      details: { model: 'mock-gpt-4', tokens: 88 },
      correlationId: 'corr_2'
    });

    const trace = await client.getTrace(traceId, organizationId, 'corr_test_fetch');
    expect(trace.events).toHaveLength(2);
    expect(trace.events[0].eventType).toBe('AI_REQUEST_ACCEPTED');
    expect(trace.events[1].eventType).toBe('AI_REQUEST_COMPLETED');
    expect(trace.events[1].details.tokens).toBe(88);
  });

  it('Gateway client throws NotFoundError when trace is missing', async () => {
    await expect(
      client.getTrace('trace_nonexistent_999', 'org_enterprise_alpha', 'corr_404')
    ).rejects.toThrow(NotFoundError);
  });
});
