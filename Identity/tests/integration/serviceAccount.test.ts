// Integration Tests: Service Account Management, Credential Security, and Rotation

import request from 'supertest';
import { app } from '../../src/app';
import { serviceAccountRepository } from '../../src/repositories/serviceAccount.repository';
import { signAccessToken } from '../../src/utils/jwt';

describe('Service Account API (/v1/service-accounts)', () => {
  const orgId = 'org-sa-test-uuid';

  const adminToken = signAccessToken({
    id: 'admin-id',
    organizationId: orgId,
    type: 'USER',
    role: 'ORGANIZATION_ADMIN',
    permissions: [
      'service_accounts:read',
      'service_accounts:create',
      'service_accounts:rotate',
      'service_accounts:revoke',
      'organization:read',
      'users:read'
    ]
  });

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /v1/service-accounts', () => {
    it('should create a service account and return the plaintext secret ONCE', async () => {
      jest.spyOn(serviceAccountRepository, 'create').mockImplementationOnce(async (data: any) => ({
        id: 'sa-1-id',
        organizationId: orgId,
        name: data.name,
        keyPrefix: data.keyPrefix,
        secretHash: data.secretHash,
        permissions: JSON.stringify(data.permissions),
        status: 'ACTIVE',
        createdBy: 'admin-id',
        lastUsedAt: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      const response = await request(app)
        .post('/v1/service-accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'gateway-security-bot',
          permissions: ['organization:read', 'users:read']
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBe('sa-1-id');
      expect(response.body.apiKey).toBeDefined();
      expect(response.body.apiKey).toMatch(/^aegis_sa_[0-9a-f]{8}_[0-9a-f]{48}$/);
      expect(response.body.secretHash).toBeUndefined(); // Never leaked
    });

    it('SECURITY REGRESSION: should prevent caller from granting permissions they do not possess', async () => {
      const limitedCallerToken = signAccessToken({
        id: 'limited-caller',
        organizationId: orgId,
        type: 'USER',
        role: 'ORGANIZATION_ADMIN',
        permissions: ['service_accounts:create', 'organization:read'] // Does NOT have 'users:disable'
      });

      const response = await request(app)
        .post('/v1/service-accounts')
        .set('Authorization', `Bearer ${limitedCallerToken}`)
        .send({
          name: 'unauthorized-escalator-bot',
          permissions: ['users:disable'] // Attempting to grant unowned permission
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(response.body.error.message).toContain('Cannot grant permissions');
    });
  });

  describe('GET /v1/service-accounts', () => {
    it('should list service accounts without exposing secrets', async () => {
      jest.spyOn(serviceAccountRepository, 'listByOrganization').mockResolvedValueOnce({
        accounts: [
          {
            id: 'sa-1',
            organizationId: orgId,
            name: 'sa-bot',
            keyPrefix: 'aegis_sa_12345678',
            secretHash: 'hash_should_never_be_returned',
            permissions: JSON.stringify(['organization:read']),
            status: 'ACTIVE',
            createdBy: 'admin',
            lastUsedAt: null,
            expiresAt: null,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ],
        total: 1
      });

      const response = await request(app)
        .get('/v1/service-accounts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.accounts).toHaveLength(1);
      expect(response.body.accounts[0].apiKey).toBeUndefined(); // NEVER in GET
      expect(response.body.accounts[0].secretHash).toBeUndefined();
    });
  });

  describe('POST /v1/service-accounts/:id/rotate', () => {
    it('should rotate credentials and return a new one-time secret', async () => {
      jest.spyOn(serviceAccountRepository, 'findById').mockResolvedValueOnce({
        id: 'sa-rotate-id',
        organizationId: orgId,
        name: 'rotatable-bot',
        keyPrefix: 'aegis_sa_oldprefix',
        secretHash: 'oldhash',
        permissions: JSON.stringify(['organization:read']),
        status: 'ACTIVE',
        createdBy: 'admin',
        lastUsedAt: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      jest.spyOn(serviceAccountRepository, 'updateSecret').mockImplementationOnce(
        async (_id: any, _orgId: any, keyPrefix: any, secretHash: any) => ({
          id: 'sa-rotate-id',
          organizationId: orgId,
          name: 'rotatable-bot',
          keyPrefix,
          secretHash,
          permissions: JSON.stringify(['organization:read']),
          status: 'ACTIVE',
          createdBy: 'admin',
          lastUsedAt: null,
          expiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      );

      const response = await request(app)
        .post('/v1/service-accounts/sa-rotate-id/rotate')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.apiKey).toBeDefined();
      expect(response.body.apiKey).toMatch(/^aegis_sa_[0-9a-f]{8}_[0-9a-f]{48}$/);
    });
  });

  describe('POST /v1/service-accounts/:id/revoke', () => {
    it('should revoke a service account', async () => {
      jest.spyOn(serviceAccountRepository, 'findById').mockResolvedValueOnce({
        id: 'sa-revoke-id',
        organizationId: orgId,
        name: 'revokable-bot',
        keyPrefix: 'aegis_sa_prefix',
        secretHash: 'hash',
        permissions: JSON.stringify(['organization:read']),
        status: 'ACTIVE',
        createdBy: 'admin',
        lastUsedAt: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      jest.spyOn(serviceAccountRepository, 'revoke').mockResolvedValueOnce({
        id: 'sa-revoke-id',
        organizationId: orgId,
        name: 'revokable-bot',
        keyPrefix: 'aegis_sa_prefix',
        secretHash: 'hash',
        permissions: JSON.stringify(['organization:read']),
        status: 'REVOKED',
        createdBy: 'admin',
        lastUsedAt: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const response = await request(app)
        .post('/v1/service-accounts/sa-revoke-id/revoke')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('REVOKED');
    });
  });
});
