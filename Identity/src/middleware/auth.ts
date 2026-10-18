// Authentication Middleware: Bearer JWT and Service Account API Key Verification

import { NextFunction, Request, Response } from 'express';
import { serviceAccountRepository } from '../repositories/serviceAccount.repository';
import { AuthenticatedPrincipal, Permission } from '../types';
import { parseAndVerifyApiKey } from '../utils/crypto';
import { verifyAccessToken } from '../utils/jwt';

declare global {
  namespace Express {
    interface Request {
      principal?: AuthenticatedPrincipal;
      correlationId?: string;
    }
  }
}

export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  const correlationId = req.correlationId || 'unknown';
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'] as string | undefined;

  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (apiKeyHeader) {
    token = apiKeyHeader.trim();
  }

  if (!token) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication credential is required.',
        correlationId
      }
    });
  }

  // Check if it's a Service Account machine key (format: aegis_sa_<prefix>_<secret>)
  if (token.startsWith('aegis_sa_')) {
    try {
      const parts = token.split('_');
      if (parts.length < 4) {
        return res.status(401).json({
          error: {
            code: 'INVALID_CREDENTIAL',
            message: 'Invalid service account API key format.',
            correlationId
          }
        });
      }

      const keyPrefix = `aegis_sa_${parts[2]}`;
      const sa = await serviceAccountRepository.findByKeyPrefix(keyPrefix);

      if (!sa || sa.status !== 'ACTIVE') {
        return res.status(401).json({
          error: {
            code: 'INVALID_CREDENTIAL',
            message: 'Service account credential is invalid or inactive.',
            correlationId
          }
        });
      }

      // Check expiration if set
      if (sa.expiresAt && sa.expiresAt.getTime() < Date.now()) {
        return res.status(401).json({
          error: {
            code: 'CREDENTIAL_EXPIRED',
            message: 'Service account credential has expired.',
            correlationId
          }
        });
      }

      const isValid = parseAndVerifyApiKey(token, sa.secretHash);
      if (!isValid) {
        return res.status(401).json({
          error: {
            code: 'INVALID_CREDENTIAL',
            message: 'Invalid service account secret.',
            correlationId
          }
        });
      }

      // Asynchronously update last used timestamp without blocking
      serviceAccountRepository.updateLastUsed(sa.id).catch(() => {});

      let permissions: Permission[] = [];
      try {
        permissions = JSON.parse(sa.permissions);
      } catch {
        permissions = [];
      }

      req.principal = {
        id: sa.id,
        organizationId: sa.organizationId,
        type: 'SERVICE_ACCOUNT',
        displayName: sa.name,
        permissions
      };

      return next();
    } catch (err: any) {
      return res.status(401).json({
        error: {
          code: 'AUTH_FAILED',
          message: 'Failed to verify service account credential.',
          correlationId
        }
      });
    }
  }

  // Human User JWT Access Token flow
  try {
    const payload = verifyAccessToken(token);

    req.principal = {
      id: payload.sub,
      organizationId: payload.org_id,
      type: payload.type,
      email: payload.email,
      displayName: payload.displayName,
      role: payload.role,
      permissions: payload.permissions || []
    };

    return next();
  } catch (error: any) {
    const code = error.code || 'TOKEN_INVALID';
    const message =
      code === 'TOKEN_EXPIRED'
        ? 'Access token has expired.'
        : 'Access token signature or claims are invalid.';

    return res.status(401).json({
      error: {
        code,
        message,
        correlationId
      }
    });
  }
}
