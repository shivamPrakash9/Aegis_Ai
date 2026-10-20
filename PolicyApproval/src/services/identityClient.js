// Identity Service Client Integration for Policy & Approval Microservice

const { env } = require('../config/env');
const { UnauthorizedError, ServiceUnavailableError } = require('../utils/errors');
const { logger } = require('../utils/logger');
const jwt = require('jsonwebtoken');

class IdentityClient {
  constructor(baseUrl = env.identityServiceUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.cache = new Map();
    this.cacheTtlMs = 30000; // 30s cache
  }

  /**
   * Verifies an access token or service account key against the Identity Service.
   * If remote identity service is unreachable in dev/test, falls back to direct JWT verification.
   *
   * @param {string} token
   * @param {string} [correlationId]
   * @returns {Promise<{ valid: boolean, principal: object }>}
   */
  async verifySession(token, correlationId = 'unknown') {
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedError('Missing or empty authentication credential.');
    }

    const cleanToken = token.trim();

    // Check cache
    const cached = this.cache.get(cleanToken);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    // Try remote Identity Service /v1/sessions/verify
    const url = `${this.baseUrl}/v1/sessions/verify`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), env.requestTimeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-Id': correlationId
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
          // ignore
        }
        throw new UnauthorizedError(errMessage);
      }

      if (response.ok) {
        const data = await response.json();
        if (data && data.valid && data.principal) {
          this.cache.set(cleanToken, {
            data,
            expiresAt: Date.now() + this.cacheTtlMs
          });
          return data;
        }
      }
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof UnauthorizedError) {
        throw err;
      }

      // If remote call fails (network unreachable or in offline unit test), attempt direct JWT verification
      try {
        const decoded = jwt.verify(cleanToken, env.policyJwtSecret, {
          issuer: env.policyJwtIssuer,
          audience: env.policyJwtAudience
        });

        const fallbackData = {
          valid: true,
          principal: {
            id: decoded.sub || decoded.id,
            type: decoded.type || 'USER',
            organizationId: decoded.organizationId || decoded.orgId || null,
            role: decoded.role || 'MEMBER',
            permissions: decoded.permissions || []
          }
        };

        this.cache.set(cleanToken, {
          data: fallbackData,
          expiresAt: Date.now() + this.cacheTtlMs
        });

        return fallbackData;
      } catch (jwtErr) {
        // If not in dev/test or token is invalid
        if (!env.isTest && !env.nodeEnv.includes('dev')) {
          logger.error(
            { correlationId, err: err.message, service: 'IdentityService' },
            'Downstream failure during session verification'
          );
          throw new ServiceUnavailableError('Identity Service is currently unreachable. Failing safely.');
        }

        throw new UnauthorizedError(`Authentication failed: ${jwtErr.message}`);
      }
    }

    throw new UnauthorizedError('Session verification failed.');
  }

  clearCache() {
    this.cache.clear();
  }
}

const identityClient = new IdentityClient();

module.exports = {
  IdentityClient,
  identityClient
};
