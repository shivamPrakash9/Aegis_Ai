// Role and Permission Authorization Middleware

const { ForbiddenError, UnauthorizedError } = require('../utils/errors');

/**
 * Authorizes request based on principal roles or permissions.
 * @param {string[]} allowedRoles
 */
function authorize(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.principal) {
      return next(new UnauthorizedError('Caller context not established.'));
    }

    if (req.isInternalService || req.principal.role === 'INTERNAL_SERVICE' || req.principal.role === 'GATEWAY_SERVICE') {
      return next();
    }

    if (allowedRoles.length === 0) {
      return next();
    }

    const principalRole = req.principal.role;
    if (allowedRoles.includes(principalRole) || principalRole === 'ORGANIZATION_ADMIN' || principalRole === 'SUPER_ADMIN') {
      return next();
    }

    return next(
      new ForbiddenError(`Caller role '${principalRole}' does not possess required authorization.`)
    );
  };
}

module.exports = { authorize };
