// Authentication and Tenant Isolation Middleware

const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');
const { logger } = require('../utils/logger');

/**
 * Middleware enforcing authentication via local JWT or trusted internal service key.
 * Enforces tenant isolation if an explicit organization context is provided.
 *
 * @param {object} [options]
 * @param {boolean} [options.optional=false] If true, allows unauthenticated requests but validates any provided token
 */
function authenticate(options = { optional: false }) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    const serviceKeyHeader = req.headers['x-internal-service-key'];

    // 1. Check for trusted service-to-service key
    if (serviceKeyHeader) {
      if (serviceKeyHeader === env.internalServiceKey) {
        req.isInternalService = true;
        req.principal = {
          id: 'service:internal',
          type: 'SERVICE',
          role: 'INTERNAL_SERVICE',
          organizationId: req.body?.organizationId || req.query?.organizationId || req.params?.organizationId || null
        };
        return next();
      } else {
        return next(new UnauthorizedError('Invalid internal service authentication key.'));
      }
    }

    // 2. Check for Bearer JWT token
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();

      try {
        const decoded = jwt.verify(token, env.privacyJwtSecret, {
          issuer: env.privacyJwtIssuer,
          audience: env.privacyJwtAudience
        });

        const orgId = decoded.organizationId || decoded.orgId || null;

        req.principal = {
          id: decoded.sub || decoded.id,
          type: 'USER',
          organizationId: orgId,
          role: decoded.role || 'MEMBER',
          permissions: decoded.permissions || []
        };

        // Enforce tenant isolation against requested organizationId
        const requestedOrg = req.body?.organizationId || req.query?.organizationId || req.params?.organizationId;
        if (requestedOrg && orgId && requestedOrg !== orgId && req.principal.role !== 'SUPER_ADMIN') {
          return next(new ForbiddenError('Cross-tenant access rejected: Token organization does not match request.'));
        }

        return next();
      } catch (jwtErr) {
        logger.warn({ err: jwtErr.message }, 'JWT verification failed in Privacy Scanner');
        return next(new UnauthorizedError(`Authentication failed: ${jwtErr.message}`));
      }
    }

    // 3. Fallback for internal AI Gateway integration
    // When called from internal gateway in development/testing without token, verify if correlation ID is present
    if (!options.optional) {
      // If environment permits internal network gateway trust when internalServiceKey is unset or in dev mode
      if (req.headers['x-correlation-id'] && (env.isTest || (!env.isProduction && !req.headers.authorization))) {
        req.isInternalService = true;
        req.principal = {
          id: 'service:gateway',
          type: 'SERVICE',
          role: 'GATEWAY_SERVICE',
          organizationId: req.body?.organizationId || null
        };
        return next();
      }

      return next(new UnauthorizedError('Authentication credentials (Bearer token or service key) required.'));
    }

    next();
  };
}

module.exports = { authenticate };
