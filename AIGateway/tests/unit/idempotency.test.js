// Unit Tests: Distributed Idempotency Coordination

const { IdempotencyService } = require('../../src/services/idempotency.service');
const { ConflictError, BadRequestError } = require('../../src/utils/errors');

describe('Idempotency Service', () => {
  let idempotencyService;
  let mockStore;

  beforeEach(() => {
    mockStore = new Map();
    const storeAdapter = {
      get: async (k) => mockStore.get(k) || null,
      set: async (k, v) => mockStore.set(k, v),
      del: async (k) => mockStore.delete(k)
    };
    idempotencyService = new IdempotencyService(() => storeAdapter);
  });

  it('should generate consistent SHA-256 fingerprint regardless of key ordering', () => {
    const payloadA = {
      messages: [{ role: 'user', content: 'Hello' }],
      metadata: { a: 1, b: 2 }
    };
    const payloadB = {
      metadata: { a: 1, b: 2 },
      messages: [{ role: 'user', content: 'Hello' }]
    };

    const fpA = idempotencyService.computeFingerprint(payloadA);
    const fpB = idempotencyService.computeFingerprint(payloadB);

    expect(fpA).toBe(fpB);
    expect(fpA).toHaveLength(64);
  });

  it('should generate different fingerprints for different payloads', () => {
    const payload1 = { messages: [{ role: 'user', content: 'Message 1' }] };
    const payload2 = { messages: [{ role: 'user', content: 'Message 2' }] };

    const fp1 = idempotencyService.computeFingerprint(payload1);
    const fp2 = idempotencyService.computeFingerprint(payload2);

    expect(fp1).not.toBe(fp2);
  });

  it('should reject missing idempotency key', async () => {
    await expect(
      idempotencyService.checkOrReserve({
        organizationId: 'org-1',
        idempotencyKey: '',
        payload: {},
        requestId: 'req-1',
        traceId: 'trace-1'
      })
    ).rejects.toThrow(BadRequestError);
  });

  it('should reserve key in IN_PROGRESS state on first submission', async () => {
    const result = await idempotencyService.checkOrReserve({
      organizationId: 'org-1',
      idempotencyKey: 'idem-key-1',
      payload: { test: true },
      requestId: 'req-1',
      traceId: 'trace-1'
    });

    expect(result.isExisting).toBe(false);

    const saved = JSON.parse(mockStore.get('aegis:gateway:idempotency:org-1:idem-key-1'));
    expect(saved.status).toBe('IN_PROGRESS');
    expect(saved.requestId).toBe('req-1');
  });

  it('should prevent concurrent execution if request is still IN_PROGRESS', async () => {
    await idempotencyService.checkOrReserve({
      organizationId: 'org-1',
      idempotencyKey: 'idem-key-1',
      payload: { test: true },
      requestId: 'req-1',
      traceId: 'trace-1'
    });

    // Submit again concurrently with same key and payload
    await expect(
      idempotencyService.checkOrReserve({
        organizationId: 'org-1',
        idempotencyKey: 'idem-key-1',
        payload: { test: true },
        requestId: 'req-2',
        traceId: 'trace-2'
      })
    ).rejects.toThrow(ConflictError);
  });

  it('should return cached response on replay of completed request', async () => {
    const payload = { test: true };
    await idempotencyService.checkOrReserve({
      organizationId: 'org-1',
      idempotencyKey: 'idem-key-1',
      payload,
      requestId: 'req-1',
      traceId: 'trace-1'
    });

    const cachedOutcome = {
      requestId: 'req-1',
      status: 'ACCEPTED',
      traceId: 'trace-1',
      createdAt: '2026-10-19T00:00:00Z',
      statusUrl: '/v1/ai-requests/req-1'
    };

    await idempotencyService.commitResponse({
      organizationId: 'org-1',
      idempotencyKey: 'idem-key-1',
      payload,
      responsePayload: cachedOutcome
    });

    const replayResult = await idempotencyService.checkOrReserve({
      organizationId: 'org-1',
      idempotencyKey: 'idem-key-1',
      payload,
      requestId: 'req-new',
      traceId: 'trace-new'
    });

    expect(replayResult.isExisting).toBe(true);
    expect(replayResult.cachedResponse).toEqual(cachedOutcome);
  });

  it('should reject replay if same key is used with DIFFERENT payload', async () => {
    const payload1 = { prompt: 'Original' };
    const payload2 = { prompt: 'Modified' };

    await idempotencyService.checkOrReserve({
      organizationId: 'org-1',
      idempotencyKey: 'idem-key-1',
      payload: payload1,
      requestId: 'req-1',
      traceId: 'trace-1'
    });

    await idempotencyService.commitResponse({
      organizationId: 'org-1',
      idempotencyKey: 'idem-key-1',
      payload: payload1,
      responsePayload: { status: 'ACCEPTED' }
    });

    await expect(
      idempotencyService.checkOrReserve({
        organizationId: 'org-1',
        idempotencyKey: 'idem-key-1',
        payload: payload2,
        requestId: 'req-2',
        traceId: 'trace-2'
      })
    ).rejects.toThrow(ConflictError);
  });
});
