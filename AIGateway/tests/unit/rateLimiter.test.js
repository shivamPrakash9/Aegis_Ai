// Unit Tests: Distributed Rate Limiting

const { RateLimiterService } = require('../../src/services/rateLimiter.service');
const { TooManyRequestsError } = require('../../src/utils/errors');

describe('Rate Limiter Service', () => {
  let rateLimiter;
  let mockStore;

  beforeEach(() => {
    mockStore = new Map();
    const storeAdapter = {
      incr: async (k) => {
        const val = (mockStore.get(k) || 0) + 1;
        mockStore.set(k, val);
        return val;
      },
      expire: async () => 1
    };
    rateLimiter = new RateLimiterService(() => storeAdapter);
  });

  it('should allow requests within rate limit', async () => {
    const result = await rateLimiter.checkRateLimit('org-1', 'user-1');
    expect(result.remaining).toBeGreaterThan(0);
    expect(result.limit).toBe(100);
  });

  it('should reject request when limit is exceeded', async () => {
    // Fill quota to 100
    for (let i = 0; i < 100; i++) {
      await rateLimiter.checkRateLimit('org-1', 'user-1');
    }

    // 101st request must throw TooManyRequestsError
    await expect(rateLimiter.checkRateLimit('org-1', 'user-1')).rejects.toThrow(
      TooManyRequestsError
    );
  });
});
