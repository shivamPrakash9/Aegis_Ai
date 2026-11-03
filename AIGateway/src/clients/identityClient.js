// Identity Service REST Client Integration

const { env } = require('../config/env');
const { UnauthorizedError, ServiceUnavailableError } = require('../utils/errors');
const { logger } = require('../utils/logger');

class IdentityClient {
  constructor(baseUrl = env.identityServiceUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.cache = new Map();
    this.cacheTtlMs = 30000; // 30s short-lived cache
  }

  /**
   * Verifies an access token or service account key against the Identity Service.
   * @param {string} token
   * @param {string} correlationId
   * @returns {Promise<{ valid: boolean, principal: object }>}
   */
  async verifySession(token, correlationId) {
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedError('Missing or empty authentication credential.');
    }

    const cleanToken = token.trim();

    // Check short-lived cache
    const cached = this.cache.get(cleanToken);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const url = `${this.baseUrl}/v1/sessions/verify`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), env.requestTimeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-Id': correlationId || 'unknown'
        },
        body: JSON.stringify({ token: cleanToken }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.status === 401 || response.status === 403) {
        let errMessage = 'Credential verification failed: invalid or expired token.';
        try {
          const body = await response.json();
          if (body?.error?.message) {
            errMessage = body.error.message;
          }
        } catch {
          // ignore parse error
        }
        throw new UnauthorizedError(errMessage);
      }

      if (!response.ok) {
        throw new ServiceUnavailableError(
          `Identity service returned unexpected HTTP status: ${response.status}`
        );
      }

      const data = await response.json();

      if (!data || !data.valid || !data.principal || !data.principal.organizationId) {
        throw new UnauthorizedError('Malformed verification response from Identity Service.');
      }

      // Cache valid response
      this.cache.set(cleanToken, {
        data,
        expiresAt: Date.now() + this.cacheTtlMs
      });

      return data;
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof UnauthorizedError) {
        throw err;
      }

      logger.error(
        { correlationId, err: err.message, service: 'IdentityService' },
        'Downstream failure during session verification'
      );

      throw new ServiceUnavailableError(
        'Identity Service is currently unreachable or timed out. Failing safely.'
      );
    }
  }

  clearCache() {
    this.cache.clear();
  }
}

const defaultIdentityClient = new IdentityClient();

module.exports = {
  IdentityClient,
  identityClient: defaultIdentityClient
};
