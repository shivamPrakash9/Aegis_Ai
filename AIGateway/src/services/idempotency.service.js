// Distributed Idempotency Coordination Service

const crypto = require('crypto');
const { getRedisStore } = require('../config/redis');
const { env } = require('../config/env');
const { ConflictError, BadRequestError } = require('../utils/errors');
const { logger } = require('../utils/logger');

function canonicalize(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(canonicalize);
  }
  const result = {};
  for (const key of Object.keys(obj).sort()) {
    result[key] = canonicalize(obj[key]);
  }
  return result;
}

class IdempotencyService {
  constructor(storeProvider = getRedisStore) {
    this.getStore = storeProvider;
  }

  /**
   * Computes a canonical deterministic SHA-256 fingerprint of the request payload.
   * @param {object} payload
   * @returns {string}
   */
  computeFingerprint(payload) {
    if (!payload || typeof payload !== 'object') {
      return crypto.createHash('sha256').update('').digest('hex');
    }

    const normalized = JSON.stringify(canonicalize(payload));
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Generates namespaced Redis key scoped to organization and idempotency key.
   * @param {string} organizationId
   * @param {string} idempotencyKey
   * @returns {string}
   */
  getKey(organizationId, idempotencyKey) {
    return `aegis:gateway:idempotency:${organizationId}:${idempotencyKey}`;
  }

  /**
   * Checks whether the idempotency key was previously used, or reserves it atomically.
   *
   * @param {object} params
   * @param {string} params.organizationId
   * @param {string} params.idempotencyKey
   * @param {object} params.payload
   * @param {string} params.requestId
   * @param {string} params.traceId
   * @returns {Promise<{ isExisting: boolean, cachedResponse?: object }>}
   */
  async checkOrReserve({ organizationId, idempotencyKey, payload, requestId, traceId }) {
    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      throw new BadRequestError('Missing or invalid Idempotency-Key header.');
    }

    const key = this.getKey(organizationId, idempotencyKey.trim());
    const fingerprint = this.computeFingerprint(payload);
    const store = this.getStore();

    const existingJson = await store.get(key);

    if (existingJson) {
      let record;
      try {
        record = JSON.parse(existingJson);
      } catch {
        record = null;
      }

      if (record) {
        // Check fingerprint
        if (record.fingerprint !== fingerprint) {
          throw new ConflictError(
            'Idempotency key reused with a different request payload.'
          );
        }

        // Same fingerprint: check status
        if (record.status === 'IN_PROGRESS') {
          throw new ConflictError(
            'A request with this idempotency key is currently processing. Concurrent duplicate execution prevented.'
          );
        }

        // Return cached accepted/completed outcome
        return {
          isExisting: true,
          cachedResponse: record.responsePayload
        };
      }
    }

    // Atomically reserve the key with IN_PROGRESS state
    const reservation = {
      fingerprint,
      requestId,
      traceId,
      status: 'IN_PROGRESS',
      createdAt: new Date().toISOString()
    };

    await store.set(key, JSON.stringify(reservation), 'EX', env.idempotencyTtlSeconds);

    return { isExisting: false };
  }

  /**
   * Commits the accepted response payload into the idempotency store.
   *
   * @param {object} params
   * @param {string} params.organizationId
   * @param {string} params.idempotencyKey
   * @param {object} params.payload
   * @param {object} params.responsePayload
   */
  async commitResponse({ organizationId, idempotencyKey, payload, responsePayload }) {
    if (!idempotencyKey) return;

    const key = this.getKey(organizationId, idempotencyKey.trim());
    const fingerprint = this.computeFingerprint(payload);
    const store = this.getStore();

    const record = {
      fingerprint,
      status: 'ACCEPTED',
      responsePayload,
      committedAt: new Date().toISOString()
    };

    await store.set(key, JSON.stringify(record), 'EX', env.idempotencyTtlSeconds);
  }

  /**
   * Releases or clears the reservation on error.
   *
   * @param {string} organizationId
   * @param {string} idempotencyKey
   */
  async releaseKey(organizationId, idempotencyKey) {
    if (!idempotencyKey) return;
    try {
      const key = this.getKey(organizationId, idempotencyKey.trim());
      const store = this.getStore();
      await store.del(key);
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to release idempotency key');
    }
  }
}

module.exports = {
  IdempotencyService,
  idempotencyService: new IdempotencyService()
};
