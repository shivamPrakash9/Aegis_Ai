// Role-Based Authorization Middleware for Security & Audit Microservice

const { ForbiddenError, UnauthorizedError } = require('../utils/errors');

/**
 * Authorizes request based on caller's role.
 *
 * @param {string[]} allowedRoles
 */
function authorize(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.principal) {
      return next(new UnauthorizedError('Caller identity is not authenticated.'));
    }

    if (req.isInternalService) {
      return next();
    }

    const role = req.principal.role || 'MEMBER';

    if (role === 'SUPER_ADMIN') {
      return next();
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
      return next(
        new ForbiddenError(
          `Role '${role}' is not authorized to access this audit resource. Required roles: ${allowedRoles.join(', ')}`
        )
      );
    }

    next();
  };
}

module.exports = { authorize };
