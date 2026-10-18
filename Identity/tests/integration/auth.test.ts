// Integration Tests: Authentication, Token Rotation, Replay Detection, and Profile

import request from 'supertest';
import { app } from '../../src/app';
import { organizationRepository } from '../../src/repositories/organization.repository';
import { refreshTokenRepository } from '../../src/repositories/refreshToken.repository';
import { userRepository } from '../../src/repositories/user.repository';
import { hashPassword, hashSha256 } from '../../src/utils/crypto';
import { signAccessToken } from '../../src/utils/jwt';

describe('Authentication API (/v1/auth)', () => {
  const orgId = 'org-auth-test-uuid';
  const userId = 'user-auth-test-uuid';
  const rawPassword = 'ValidPassword123!';
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await hashPassword(rawPassword);
  });

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /v1/auth/login', () => {
    it('should authenticate active user with valid credentials and return token pair', async () => {
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValueOnce({
        id: userId,
        organizationId: orgId,
        email: 'alice@aegis.local',
        passwordHash,
        displayName: 'Alice Developer',
        role: 'DEVELOPER',
        status: 'ACTIVE',
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      jest.spyOn(organizationRepository, 'findById').mockResolvedValueOnce({
        id: orgId,
        name: 'Aegis Security Org',
        slug: 'aegis-security',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      jest.spyOn(userRepository, 'updateLastLogin').mockResolvedValueOnce();
      jest.spyOn(refreshTokenRepository, 'create').mockResolvedValueOnce({} as any);

      const response = await request(app)
        .post('/v1/auth/login')
        .send({ email: 'alice@aegis.local', password: rawPassword });

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('alice@aegis.local');
      expect(response.body.user.passwordHash).toBeUndefined(); // Never leak hash
      expect(response.body.tokens.accessToken).toBeDefined();
      expect(response.body.tokens.refreshToken).toBeDefined();
      expect(response.body.tokens.tokenType).toBe('Bearer');
    });

    it('should reject incorrect password with generic error message', async () => {
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValueOnce({
        id: userId,
        organizationId: orgId,
        email: 'alice@aegis.local',
        passwordHash,
        displayName: 'Alice Developer',
        role: 'DEVELOPER',
        status: 'ACTIVE',
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const response = await request(app)
        .post('/v1/auth/login')
        .send({ email: 'alice@aegis.local', password: 'IncorrectPassword999!' });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(response.body.error.message).toBe('Invalid email or password.');
    });

    it('should reject login for inactive or suspended user', async () => {
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValueOnce({
        id: userId,
        organizationId: orgId,
        email: 'disabled@aegis.local',
        passwordHash,
        displayName: 'Disabled User',
        role: 'DEVELOPER',
        status: 'INACTIVE',
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const response = await request(app)
        .post('/v1/auth/login')
        .send({ email: 'disabled@aegis.local', password: rawPassword });

      expect(response.status).toBe(401);
      expect(response.body.error.message).toContain('Account is inactive');
    });

    it('should reject login if organization is suspended', async () => {
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValueOnce({
        id: userId,
        organizationId: orgId,
        email: 'user@suspended.local',
        passwordHash,
        displayName: 'User in Suspended Org',
        role: 'DEVELOPER',
        status: 'ACTIVE',
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      jest.spyOn(organizationRepository, 'findById').mockResolvedValueOnce({
        id: orgId,
        name: 'Suspended Org',
        slug: 'suspended-org',
        status: 'SUSPENDED',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const response = await request(app)
        .post('/v1/auth/login')
        .send({ email: 'user@suspended.local', password: rawPassword });

      expect(response.status).toBe(401);
      expect(response.body.error.message).toContain('Organization is inactive');
    });
  });

  describe('POST /v1/auth/refresh', () => {
    it('should successfully rotate refresh token and issue new token pair', async () => {
      const rawRefreshToken = 'valid_refresh_token_string_example_longer_than_20_chars';
      const tokenHash = hashSha256(rawRefreshToken);
      const familyId = 'family-uuid-1';

      jest.spyOn(refreshTokenRepository, 'findByTokenHash').mockResolvedValueOnce({
        id: 'token-db-id-1',
        userId,
        organizationId: orgId,
        tokenHash,
        familyId,
        isRevoked: false,
        expiresAt: new Date(Date.now() + 1000000),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      jest.spyOn(refreshTokenRepository, 'revoke').mockResolvedValueOnce();
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({
        id: userId,
        organizationId: orgId,
        email: 'alice@aegis.local',
        passwordHash,
        displayName: 'Alice Developer',
        role: 'DEVELOPER',
        status: 'ACTIVE',
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      jest.spyOn(organizationRepository, 'findById').mockResolvedValueOnce({
        id: orgId,
        name: 'Aegis Org',
        slug: 'aegis-org',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      jest.spyOn(refreshTokenRepository, 'create').mockResolvedValueOnce({} as any);

      const response = await request(app)
        .post('/v1/auth/refresh')
        .send({ refreshToken: rawRefreshToken });

      expect(response.status).toBe(200);
      expect(response.body.tokens.accessToken).toBeDefined();
      expect(response.body.tokens.refreshToken).toBeDefined();
      expect(response.body.tokens.refreshToken).not.toEqual(rawRefreshToken); // Rotated!
    });

    it('should detect REPLAY ATTACK and revoke entire family if revoked token is reused', async () => {
      const reusedToken = 'reused_compromised_token_string_longer_than_20_chars';
      const familyId = 'compromised-family-id';

      jest.spyOn(refreshTokenRepository, 'findByTokenHash').mockResolvedValueOnce({
        id: 'compromised-id',
        userId,
        organizationId: orgId,
        tokenHash: hashSha256(reusedToken),
        familyId,
        isRevoked: true, // Already revoked!
        expiresAt: new Date(Date.now() + 1000000),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const revokeFamilySpy = jest
        .spyOn(refreshTokenRepository, 'revokeFamily')
        .mockResolvedValueOnce();

      const response = await request(app)
        .post('/v1/auth/refresh')
        .send({ refreshToken: reusedToken });

      expect(response.status).toBe(401);
      expect(response.body.error.message).toContain('Compromised session revoked');
      expect(revokeFamilySpy).toHaveBeenCalledWith(familyId);
    });
  });

  describe('POST /v1/auth/logout', () => {
    it('should revoke session family on logout and return 204', async () => {
      const rawToken = 'logout_token_string_valid_longer_than_20_chars';
      jest.spyOn(refreshTokenRepository, 'findByTokenHash').mockResolvedValueOnce({
        id: 'token-id',
        userId,
        organizationId: orgId,
        tokenHash: hashSha256(rawToken),
        familyId: 'family-logout-id',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 100000),
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const revokeSpy = jest
        .spyOn(refreshTokenRepository, 'revokeFamily')
        .mockResolvedValueOnce();

      const response = await request(app)
        .post('/v1/auth/logout')
        .send({ refreshToken: rawToken });

      expect(response.status).toBe(204);
      expect(revokeSpy).toHaveBeenCalledWith('family-logout-id');
    });
  });

  describe('GET /v1/auth/me', () => {
    it('should return safe authenticated caller context', async () => {
      const token = signAccessToken({
        id: userId,
        organizationId: orgId,
        type: 'USER',
        email: 'alice@aegis.local',
        displayName: 'Alice Developer',
        role: 'DEVELOPER',
        permissions: ['organization:read', 'users:read']
      });

      const response = await request(app)
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(userId);
      expect(response.body.email).toBe('alice@aegis.local');
      expect(response.body.permissions).toEqual(['organization:read', 'users:read']);
    });

    it('should reject unauthenticated request with 401', async () => {
      const response = await request(app).get('/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
