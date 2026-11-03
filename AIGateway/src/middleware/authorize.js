// Authorization and Permission Enforcement Middleware

const { ForbiddenError, UnauthorizedError } = require('../utils/errors');

/**
 * Middleware factory requiring that the authenticated principal possesses specified permissions or roles.
 * @param {string | string[]} requiredPermissions
 */
function authorize(requiredPermissions = []) {
  const permissionsList = Array.isArray(requiredPermissions)
    ? requiredPermissions
    : [requiredPermissions];

  return (req, res, next) => {
    if (!req.principal) {
      return next(new UnauthorizedError('Unauthenticated request context.'));
    }

    // Admins have broad access
    if (req.principal.role === 'ORGANIZATION_ADMIN') {
      return next();
    }

    const principalPermissions = new Set(req.principal.permissions || []);

    // Check if principal possesses any required permission or all required permissions
    const hasRequired = permissionsList.length === 0 || permissionsList.some((p) => principalPermissions.has(p));

    if (!hasRequired) {
      return next(
        new ForbiddenError(
          `Principal does not possess required permission: [${permissionsList.join(', ')}]`
        )
      );
    }

    next();
  };
}

module.exports = { authorize };
