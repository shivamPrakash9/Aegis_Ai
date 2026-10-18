// Integration Tests: Session & Credential Verification Endpoint for AI Gateway

import request from 'supertest';
import { app } from '../../src/app';
import { organizationRepository } from '../../src/repositories/organization.repository';
import { serviceAccountRepository } from '../../src/repositories/serviceAccount.repository';
import { userRepository } from '../../src/repositories/user.repository';
import { generateServiceAccountKey } from '../../src/utils/crypto';
import { signAccessToken } from '../../src/utils/jwt';

describe('Session Verification API (POST /v1/sessions/verify)', () => {
  const orgId = 'org-session-uuid';
  const userId = 'user-session-uuid';

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('should successfully verify a valid JWT access token and return verified principal', async () => {
    const token = signAccessToken({
      id: userId,
      organizationId: orgId,
      type: 'USER',
      email: 'gateway-user@aegis.local',
      displayName: 'Gateway Caller',
      role: 'DEVELOPER',
      permissions: ['organization:read', 'users:read']
    });

    jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({
      id: userId,
      organizationId: orgId,
      email: 'gateway-user@aegis.local',
      passwordHash: 'hash',
      displayName: 'Gateway Caller',
      role: 'DEVELOPER',
      status: 'ACTIVE',
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    jest.spyOn(organizationRepository, 'findById').mockResolvedValueOnce({
      id: orgId,
      name: 'Session Org',
      slug: 'session-org',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const response = await request(app)
      .post('/v1/sessions/verify')
      .send({ token });

    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(true);
    expect(response.body.principal.id).toBe(userId);
    expect(response.body.principal.organizationId).toBe(orgId);
    expect(response.body.principal.type).toBe('USER');
    expect(response.body.principal.role).toBe('DEVELOPER');
    expect(response.body.principal.permissions).toEqual(['organization:read', 'users:read']);
    // Verify supplied token is NEVER echoed back
    expect(response.body.token).toBeUndefined();
  });

  it('should successfully verify a valid Machine API Key and return verified principal', async () => {
    const { apiKey, keyPrefix, secretHash } = generateServiceAccountKey();

    jest.spyOn(serviceAccountRepository, 'findByKeyPrefix').mockResolvedValueOnce({
      id: 'sa-bot-id',
      organizationId: orgId,
      name: 'ai-gateway-scanner',
      keyPrefix,
      secretHash,
      permissions: JSON.stringify(['organization:read', 'service_accounts:read']),
      status: 'ACTIVE',
      createdBy: 'admin',
      lastUsedAt: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    jest.spyOn(organizationRepository, 'findById').mockResolvedValueOnce({
      id: orgId,
      name: 'Session Org',
      slug: 'session-org',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    jest.spyOn(serviceAccountRepository, 'updateLastUsed').mockResolvedValueOnce();

    const response = await request(app)
      .post('/v1/sessions/verify')
      .send({ token: apiKey });

    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(true);
    expect(response.body.principal.id).toBe('sa-bot-id');
    expect(response.body.principal.type).toBe('SERVICE_ACCOUNT');
    expect(response.body.principal.displayName).toBe('ai-gateway-scanner');
    expect(response.body.principal.permissions).toEqual([
      'organization:read',
      'service_accounts:read'
    ]);
    expect(response.body.apiKey).toBeUndefined();
  });

  it('SECURITY REGRESSION: should reject verification if account was disabled even if JWT is unexpired', async () => {
    const token = signAccessToken({
      id: 'disabled-user-id',
      organizationId: orgId,
      type: 'USER',
      email: 'disabled@aegis.local',
      role: 'DEVELOPER',
      permissions: ['users:read']
    });

    jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({
      id: 'disabled-user-id',
      organizationId: orgId,
      email: 'disabled@aegis.local',
      passwordHash: 'hash',
      displayName: 'Disabled',
      role: 'DEVELOPER',
      status: 'INACTIVE', // Disabled!
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const response = await request(app)
      .post('/v1/sessions/verify')
      .send({ token });

    expect(response.status).toBe(401);
    expect(response.body.error.message).toContain('inactive or disabled');
  });

  it('should reject invalid or malformed tokens with 401', async () => {
    const response = await request(app)
      .post('/v1/sessions/verify')
      .send({ token: 'completely_invalid_garbage_token_string' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
