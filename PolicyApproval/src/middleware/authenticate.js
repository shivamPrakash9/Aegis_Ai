// Authentication and Tenant Isolation Middleware for Policy & Approval Microservice

const { env } = require('../config/env');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');
const { logger } = require('../utils/logger');
const { identityClient } = require('../services/identityClient');

/**
 * Middleware enforcing authentication via local/remote JWT or trusted internal service key.
 * Enforces tenant isolation if an explicit organization context is provided.
 *
 * @param {object} [options]
 * @param {boolean} [options.optional=false] If true, allows unauthenticated requests but validates any provided token
 */
function authenticate(options = { optional: false }) {
  return async (req, res, next) => {
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

    // 2. Check for Bearer token
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();

      try {
        const verification = await identityClient.verifySession(token, req.correlationId);

        if (!verification || !verification.valid || !verification.principal) {
          return next(new UnauthorizedError('Token verification failed: invalid session.'));
        }

        req.principal = verification.principal;

        // Enforce tenant isolation against requested organizationId
        const requestedOrg = req.body?.organizationId || req.query?.organizationId || req.params?.organizationId;
        const principalOrg = req.principal.organizationId;

        if (requestedOrg && principalOrg && requestedOrg !== principalOrg && req.principal.role !== 'SUPER_ADMIN') {
          return next(new ForbiddenError('Cross-tenant access rejected: Principal organization does not match request.'));
        }

        return next();
      } catch (err) {
        logger.warn({ err: err.message }, 'Authentication verification failed in Policy Service');
        return next(err instanceof UnauthorizedError || err instanceof ForbiddenError ? err : new UnauthorizedError(err.message));
      }
    }

    // 3. Fallback for internal AI Gateway integration
    // When called from internal gateway in dev/test mode without bearer token, allow via correlation ID or service context
    if (req.headers['x-correlation-id'] && (env.isTest || (!env.isProduction && !req.headers.authorization))) {
      req.isInternalService = true;
      req.principal = req.body?.principal || {
        id: 'service:gateway',
        type: 'SERVICE',
        role: 'GATEWAY_SERVICE',
        organizationId: req.body?.organizationId || null
      };
      return next();
    }

    if (!options.optional) {
      return next(new UnauthorizedError('Authentication credentials (Bearer token or service key) required.'));
    }

    next();
  };
}

module.exports = { authenticate };
