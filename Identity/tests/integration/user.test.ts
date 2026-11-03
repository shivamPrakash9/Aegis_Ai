// Integration Tests: User Management, Privilege Escalation Prevention, and Account Disabling

import request from 'supertest';
import { app } from '../../src/app';
import { refreshTokenRepository } from '../../src/repositories/refreshToken.repository';
import { userRepository } from '../../src/repositories/user.repository';
import { signAccessToken } from '../../src/utils/jwt';

describe('User Management API (/v1/users)', () => {
  const orgId = 'org-user-test-uuid';

  const adminToken = signAccessToken({
    id: 'admin-user-id',
    organizationId: orgId,
    type: 'USER',
    role: 'ORGANIZATION_ADMIN',
    permissions: [
      'users:read',
      'users:create',
      'users:update',
      'users:disable',
      'organization:read'
    ]
  });

  const devToken = signAccessToken({
    id: 'dev-user-id',
    organizationId: orgId,
    type: 'USER',
    role: 'DEVELOPER',
    permissions: ['users:read', 'organization:read']
  });

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /v1/users', () => {
    it('should allow Organization Admin to create a new user', async () => {
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValueOnce(null);
      jest.spyOn(userRepository, 'create').mockResolvedValueOnce({
        id: 'new-user-id',
        organizationId: orgId,
        email: 'bob@aegis.local',
        passwordHash: 'argon_hash_hidden',
        displayName: 'Bob Engineer',
        role: 'DEVELOPER',
        status: 'ACTIVE',
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const response = await request(app)
        .post('/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'bob@aegis.local',
          password: 'Password123!',
          displayName: 'Bob Engineer',
          role: 'DEVELOPER'
        });

      expect(response.status).toBe(201);
      expect(response.body.email).toBe('bob@aegis.local');
      expect(response.body.passwordHash).toBeUndefined(); // Never returned!
    });

    it('SECURITY REGRESSION: should prevent caller without users:create permission from creating users', async () => {
      // devToken lacks users:create permission
      const response = await request(app)
        .post('/v1/users')
        .set('Authorization', `Bearer ${devToken}`)
        .send({
          email: 'charlie@aegis.local',
          password: 'Password123!',
          displayName: 'Charlie'
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('SECURITY REGRESSION: should reject privilege escalation when non-admin attempts to create an admin', async () => {
      // Even if caller somehow had users:create permission, non-admin role cannot create ORGANIZATION_ADMIN
      const customTokenWithCreate = signAccessToken({
        id: 'auditor-user-id',
        organizationId: orgId,
        type: 'USER',
        role: 'SECURITY_AUDITOR',
        permissions: ['users:create', 'users:read']
      });

      const response = await request(app)
        .post('/v1/users')
        .set('Authorization', `Bearer ${customTokenWithCreate}`)
        .send({
          email: 'escalated@aegis.local',
          password: 'Password123!',
          displayName: 'Escalated Admin',
          role: 'ORGANIZATION_ADMIN'
        });

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain('Only Organization Admins can create administrative users');
    });

    it('should reject duplicate email registration with 409 Conflict', async () => {
      jest.spyOn(userRepository, 'findByEmail').mockResolvedValueOnce({
        id: 'existing-user-id',
        organizationId: orgId,
        email: 'duplicate@aegis.local',
        passwordHash: 'hash',
        displayName: 'Existing User',
        role: 'DEVELOPER',
        status: 'ACTIVE',
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const response = await request(app)
        .post('/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'duplicate@aegis.local',
          password: 'Password123!',
          displayName: 'Duplicate User'
        });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('CONFLICT');
    });
  });

  describe('GET /v1/users', () => {
    it('should list users with pagination without exposing password hashes', async () => {
      jest.spyOn(userRepository, 'listByOrganization').mockResolvedValueOnce({
        users: [
          {
            id: 'u1',
            organizationId: orgId,
            email: 'user1@aegis.local',
            passwordHash: 'secret_hash_value',
            displayName: 'User 1',
            role: 'DEVELOPER',
            status: 'ACTIVE',
            lastLoginAt: null,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ],
        total: 1
      });

      const response = await request(app)
        .get('/v1/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(1);
      expect(response.body.users[0].email).toBe('user1@aegis.local');
      expect(response.body.users[0].passwordHash).toBeUndefined(); // Never leaked
      expect(response.body.total).toBe(1);
    });
  });

  describe('POST /v1/users/:userId/disable', () => {
    it('should disable a user and revoke all refresh tokens', async () => {
      jest.spyOn(userRepository, 'findById').mockResolvedValueOnce({
        id: 'target-user-id',
        organizationId: orgId,
        email: 'target@aegis.local',
        passwordHash: 'hash',
        displayName: 'Target User',
        role: 'DEVELOPER',
        status: 'ACTIVE',
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      jest.spyOn(userRepository, 'disable').mockResolvedValueOnce({
        id: 'target-user-id',
        organizationId: orgId,
        email: 'target@aegis.local',
        passwordHash: 'hash',
        displayName: 'Target User',
        role: 'DEVELOPER',
        status: 'INACTIVE',
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const revokeAllSpy = jest
        .spyOn(refreshTokenRepository, 'revokeAllForUser')
        .mockResolvedValueOnce();

      const response = await request(app)
        .post('/v1/users/target-user-id/disable')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('INACTIVE');
      expect(revokeAllSpy).toHaveBeenCalledWith('target-user-id');
    });
  });
});
