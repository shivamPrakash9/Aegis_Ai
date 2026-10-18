// JSON Web Token (JWT) Utilities: Sign, Verify, and Claims Extraction

import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import {
  AccessTokenPayload,
  AuthenticatedPrincipal,
  RefreshTokenPayload
} from '../types';
import { generateCorrelationId, generateSecureToken, hashSha256 } from './crypto';

const JWT_ALGORITHM: jwt.Algorithm = 'HS256';

/**
 * Sign a short-lived access token for an authenticated principal
 */
export function signAccessToken(principal: AuthenticatedPrincipal): string {
  const jti = generateCorrelationId();
  const payload: AccessTokenPayload = {
    sub: principal.id,
    iss: config.jwt.issuer,
    aud: config.jwt.audience,
    jti,
    org_id: principal.organizationId,
    type: principal.type,
    email: principal.email,
    displayName: principal.displayName,
    role: principal.role,
    permissions: principal.permissions
  };

  return jwt.sign(payload, config.jwt.accessSecret, {
    algorithm: JWT_ALGORITHM,
    expiresIn: config.jwt.accessTtl as jwt.SignOptions['expiresIn']
  });
}

/**
 * Verify and decode an access token with strict claims checking
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret, {
      algorithms: [JWT_ALGORITHM],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience
    }) as AccessTokenPayload;

    if (!decoded.sub || !decoded.org_id || !decoded.type) {
      throw new Error('Malformed token claims: missing sub, org_id, or type');
    }

    return decoded;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      const err = new Error('Access token has expired');
      (err as any).code = 'TOKEN_EXPIRED';
      throw err;
    }
    const err = new Error('Invalid access token');
    (err as any).code = 'TOKEN_INVALID';
    (err as any).details = error.message;
    throw err;
  }
}

/**
 * Generate a cryptographically secure refresh token and return its hash for DB storage
 */
export function createRefreshToken(
  userId: string,
  organizationId: string,
  existingFamilyId?: string
): {
  refreshToken: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
} {
  const familyId = existingFamilyId || generateCorrelationId();
  const rawToken = generateSecureToken(48); // 96 hex chars unpredictable string
  const tokenHash = hashSha256(rawToken);

  // Parse TTL into Date
  // Default 7 days
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return {
    refreshToken: rawToken,
    tokenHash,
    familyId,
    expiresAt
  };
}
