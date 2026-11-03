// Redis Client and Coordination Store with In-Memory Resilience Fallback

const Redis = require('ioredis');
const { env } = require('./env');
const { logger } = require('../utils/logger');

class InMemoryFallbackStore {
  constructor() {
    this.store = new Map();
    this.ttls = new Map();
  }

  _cleanExpired() {
    const now = Date.now();
    for (const [key, expireAt] of this.ttls.entries()) {
      if (expireAt <= now) {
        this.store.delete(key);
        this.ttls.delete(key);
      }
    }
  }

  async get(key) {
    this._cleanExpired();
    return this.store.get(key) || null;
  }

  async set(key, value, mode, duration) {
    this._cleanExpired();
    this.store.set(key, value);
    if (mode === 'EX' && typeof duration === 'number') {
      this.ttls.set(key, Date.now() + duration * 1000);
    }
    return 'OK';
  }

  async setnx(key, value) {
    this._cleanExpired();
    if (this.store.has(key)) {
      return 0;
    }
    this.store.set(key, value);
    return 1;
  }

  async incr(key) {
    this._cleanExpired();
    const current = parseInt(this.store.get(key) || '0', 10);
    const next = current + 1;
    this.store.set(key, String(next));
    return next;
  }

  async expire(key, seconds) {
    this._cleanExpired();
    if (this.store.has(key)) {
      this.ttls.set(key, Date.now() + seconds * 1000);
      return 1;
    }
    return 0;
  }

  async del(key) {
    this.ttls.delete(key);
    const existed = this.store.delete(key);
    return existed ? 1 : 0;
  }

  async ping() {
    return 'PONG';
  }
}

let redisClient = null;
let isConnected = false;
const fallbackStore = new InMemoryFallbackStore();

function initRedisClient() {
  if (redisClient) {
    return redisClient;
  }

  try {
    redisClient = new Redis(env.redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 2) {
          return null; // Stop retrying and allow fallback
        }
        return Math.min(times * 200, 1000);
      }
    });

    redisClient.on('connect', () => {
      isConnected = true;
      logger.info('Connected to Redis server');
    });

    redisClient.on('error', (err) => {
      isConnected = false;
      if (!env.isTest) {
        logger.warn({ err: err.message }, 'Redis error, utilizing in-memory fallback store');
      }
    });

    // Attempt initial connect without throwing
    redisClient.connect().catch((err) => {
      isConnected = false;
      if (!env.isTest) {
        logger.warn({ err: err.message }, 'Initial Redis connection failed; falling back to in-memory store');
      }
    });
  } catch (err) {
    isConnected = false;
    logger.warn({ err: err.message }, 'Failed to instantiate Redis client; fallback active');
  }

  return redisClient;
}

/**
 * Returns either the active Redis client or the resilient in-memory fallback store.
 */
function getRedisStore() {
  if (isConnected && redisClient) {
    return redisClient;
  }
  return fallbackStore;
}

/**
 * Checks Redis connectivity.
 * @returns {Promise<boolean>}
 */
async function checkRedisHealth() {
  try {
    if (isConnected && redisClient) {
      const res = await redisClient.ping();
      return res === 'PONG';
    }
    // In dev / test, in-memory store is healthy
    return !env.isProduction;
  } catch {
    return false;
  }
}

/**
 * Cleanly disconnects Redis.
 */
async function disconnectRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      redisClient.disconnect();
    }
    redisClient = null;
    isConnected = false;
  }
}

module.exports = {
  initRedisClient,
  getRedisStore,
  checkRedisHealth,
  disconnectRedis
};
