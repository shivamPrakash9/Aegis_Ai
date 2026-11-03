import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiError, tokenStore } from '../services/api-client';
import { gatewayApi } from '../services/gateway-api';

describe('API Client & Error Normalization', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    tokenStore.clearTokens();
  });

  it('ApiError constructs with status, message, and error code', () => {
    const err = new ApiError(403, 'Forbidden by policy gate', 'FORBIDDEN_POLICY', { policyId: 'pol_1' });

    expect(err.name).toBe('ApiError');
    expect(err.status).toBe(403);
    expect(err.message).toBe('Forbidden by policy gate');
    expect(err.code).toBe('FORBIDDEN_POLICY');
    expect(err.details).toEqual({ policyId: 'pol_1' });
  });

  it('generates Idempotency-Key header on Gateway request submission', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        requestId: 'req_test_123',
        status: 'ACCEPTED',
        traceId: 'trc_test_456',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await gatewayApi.submitRequest({
      messages: [{ role: 'user', content: 'Hello AI' }],
    });

    expect(res.requestId).toBe('req_test_123');
    expect(fetchMock).toHaveBeenCalled();
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.has('Idempotency-Key')).toBe(true);
  });
});
