// Unit Tests: JWT Signing, Claims Extraction, and Security Enforcement

import jwt from 'jsonwebtoken';
import { config } from '../../src/config/env';
import { AuthenticatedPrincipal } from '../../src/types';
import { createRefreshToken, signAccessToken, verifyAccessToken } from '../../src/utils/jwt';

describe('JWT Utilities', () => {
  const samplePrincipal: AuthenticatedPrincipal = {
    id: 'user-uuid-1234',
    organizationId: 'org-uuid-5678',
    type: 'USER',
    email: 'developer@example.com',
    displayName: 'Dev User',
    role: 'DEVELOPER',
    permissions: ['organization:read', 'users:read', 'service_accounts:read']
  };

  it('should sign an access token and correctly verify claims', () => {
    const token = signAccessToken(samplePrincipal);
    expect(token).toBeDefined();

    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toEqual(samplePrincipal.id);
    expect(decoded.org_id).toEqual(samplePrincipal.organizationId);
    expect(decoded.type).toEqual('USER');
    expect(decoded.email).toEqual(samplePrincipal.email);
    expect(decoded.role).toEqual(samplePrincipal.role);
    expect(decoded.permissions).toEqual(samplePrincipal.permissions);
    expect(decoded.iss).toEqual(config.jwt.issuer);
    expect(decoded.aud).toEqual(config.jwt.audience);
  });

  it('should reject an expired access token with TOKEN_EXPIRED error', () => {
    // Generate token with negative expiresIn
    const expiredToken = jwt.sign(
      {
        sub: samplePrincipal.id,
        iss: config.jwt.issuer,
        aud: config.jwt.audience,
        jti: 'some-id',
        org_id: samplePrincipal.organizationId,
        type: 'USER',
        permissions: []
      },
      config.jwt.accessSecret,
      { expiresIn: -10 }
    );

    expect(() => verifyAccessToken(expiredToken)).toThrow('Access token has expired');
  });

  it('should reject an invalid signature', () => {
    const wrongSecretToken = jwt.sign(
      {
        sub: samplePrincipal.id,
        iss: config.jwt.issuer,
        aud: config.jwt.audience,
        jti: 'some-id',
        org_id: samplePrincipal.organizationId,
        type: 'USER',
        permissions: []
      },
      'completely_different_secret_key_1234567890'
    );

    expect(() => verifyAccessToken(wrongSecretToken)).toThrow('Invalid access token');
  });

  it('should reject tokens with wrong issuer', () => {
    const wrongIssuerToken = jwt.sign(
      {
        sub: samplePrincipal.id,
        iss: 'untrusted-issuer',
        aud: config.jwt.audience,
        jti: 'some-id',
        org_id: samplePrincipal.organizationId,
        type: 'USER',
        permissions: []
      },
      config.jwt.accessSecret
    );

    expect(() => verifyAccessToken(wrongIssuerToken)).toThrow('Invalid access token');
  });

  it('should reject tokens with wrong audience', () => {
    const wrongAudienceToken = jwt.sign(
      {
        sub: samplePrincipal.id,
        iss: config.jwt.issuer,
        aud: 'wrong-audience',
        jti: 'some-id',
        org_id: samplePrincipal.organizationId,
        type: 'USER',
        permissions: []
      },
      config.jwt.accessSecret
    );

    expect(() => verifyAccessToken(wrongAudienceToken)).toThrow('Invalid access token');
  });

  it('should reject unsigned ("none" algorithm) tokens', () => {
    const unsignedToken = jwt.sign(
      {
        sub: samplePrincipal.id,
        iss: config.jwt.issuer,
        aud: config.jwt.audience,
        jti: 'some-id',
        org_id: samplePrincipal.organizationId,
        type: 'USER',
        permissions: []
      },
      '',
      { algorithm: 'none' as any }
    );

    expect(() => verifyAccessToken(unsignedToken)).toThrow('Invalid access token');
  });

  it('should generate refresh token with hash, familyId, and expiry', () => {
    const { refreshToken, tokenHash, familyId, expiresAt } = createRefreshToken(
      'user-1',
      'org-1'
    );

    expect(refreshToken).toBeDefined();
    expect(refreshToken.length).toBeGreaterThan(64);
    expect(tokenHash).toHaveLength(64);
    expect(familyId).toBeDefined();
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});
