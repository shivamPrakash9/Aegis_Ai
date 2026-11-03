// Authorization Middleware: Permission & Role Enforcement

import { NextFunction, Request, Response } from 'express';
import { Permission, UserRole } from '../types';

export function requirePermission(...requiredPermissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const correlationId = req.correlationId || 'unknown';

    if (!req.principal) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication is required before checking authorization.',
          correlationId
        }
      });
    }

    const principalPermissions = req.principal.permissions || [];
    const hasAll = requiredPermissions.every((perm) =>
      principalPermissions.includes(perm)
    );

    if (!hasAll) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have the required permissions to perform this action.',
          correlationId,
          details: {
            requiredPermissions
          }
        }
      });
    }

    next();
  };
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const correlationId = req.correlationId || 'unknown';

    if (!req.principal) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication is required.',
          correlationId
        }
      });
    }

    if (
      !req.principal.role ||
      !allowedRoles.includes(req.principal.role)
    ) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Caller role is not authorized for this resource.',
          correlationId
        }
      });
    }

    next();
  };
}
