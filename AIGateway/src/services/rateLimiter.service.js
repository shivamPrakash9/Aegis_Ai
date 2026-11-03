// Distributed Rate Limiting Service for Organizations and Callers

const { getRedisStore } = require('../config/redis');
const { env } = require('../config/env');
const { TooManyRequestsError } = require('../utils/errors');

class RateLimiterService {
  constructor(storeProvider = getRedisStore) {
    this.getStore = storeProvider;
  }

  /**
   * Enforces rate limiting per organization and caller.
   *
   * @param {string} organizationId
   * @param {string} callerId
   * @returns {Promise<{ limit: number, remaining: number, resetSeconds: number }>}
   */
  async checkRateLimit(organizationId, callerId) {
    const store = this.getStore();
    const windowSeconds = env.rateLimitWindowSeconds;
    const maxRequests = env.rateLimitMaxRequests;

    const currentBucket = Math.floor(Date.now() / (windowSeconds * 1000));
    const key = `aegis:gateway:ratelimit:${organizationId}:${callerId}:${currentBucket}`;

    const count = await store.incr(key);

    if (count === 1) {
      await store.expire(key, windowSeconds + 2);
    }

    const resetSeconds = (currentBucket + 1) * windowSeconds - Math.floor(Date.now() / 1000);
    const remaining = Math.max(0, maxRequests - count);

    if (count > maxRequests) {
      const err = new TooManyRequestsError(
        `Rate limit of ${maxRequests} requests per ${windowSeconds}s exceeded for caller.`
      );
      err.rateLimitInfo = {
        limit: maxRequests,
        remaining: 0,
        resetSeconds
      };
      throw err;
    }

    return {
      limit: maxRequests,
      remaining,
      resetSeconds
    };
  }
}

module.exports = {
  RateLimiterService,
  rateLimiterService: new RateLimiterService()
};
