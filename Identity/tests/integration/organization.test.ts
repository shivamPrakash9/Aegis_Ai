// Integration Tests: Organization Lifecycle, Bootstrap Security, and Tenant Isolation

import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/config/database';
import { config } from '../../src/config/env';
import { organizationRepository } from '../../src/repositories/organization.repository';
import { signAccessToken } from '../../src/utils/jwt';

describe('Organization API (/v1/organizations)', () => {
  const org1Id = 'org-1-uuid';
  const org2Id = 'org-2-uuid';

  const org1AdminToken = signAccessToken({
    id: 'admin-1-id',
    organizationId: org1Id,
    type: 'USER',
    role: 'ORGANIZATION_ADMIN',
    permissions: ['organization:read', 'organization:update', 'users:read']
  });

  const org2AdminToken = signAccessToken({
    id: 'admin-2-id',
    organizationId: org2Id,
    type: 'USER',
    role: 'ORGANIZATION_ADMIN',
    permissions: ['organization:read', 'organization:update', 'users:read']
  });

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /v1/organizations', () => {
    it('should create an organization with valid payload', async () => {
      jest.spyOn(organizationRepository, 'findBySlug').mockResolvedValueOnce(null);

      jest.spyOn(prisma, '$transaction').mockImplementationOnce(async (callback: any) => {
        return callback({
          organization: {
            create: jest.fn().mockResolvedValueOnce({
              id: 'new-org-id',
              name: 'Enterprise AI Lab',
              slug: 'enterprise-ai-lab',
              status: 'ACTIVE',
              createdAt: new Date(),
              updatedAt: new Date()
            })
          }
        });
      });

      const response = await request(app)
        .post('/v1/organizations')
        .send({
          name: 'Enterprise AI Lab',
          slug: 'enterprise-ai-lab'
        });

      expect(response.status).toBe(201);
      expect(response.body.organization.name).toBe('Enterprise AI Lab');
      expect(response.body.organization.slug).toBe('enterprise-ai-lab');
    });

    it('should reject initial admin creation if bootstrapKey is missing or invalid', async () => {
      jest.spyOn(organizationRepository, 'findBySlug').mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/v1/organizations')
        .send({
          name: 'Bootstrapped Org',
          slug: 'bootstrapped-org',
          bootstrapKey: 'invalid_bootstrap_key_12345',
          adminUser: {
            email: 'admin@bootstrap.com',
            password: 'AdminPassword123!',
            displayName: 'Bootstrap Admin'
          }
        });

      expect(response.status).toBe(401);
      expect(response.body.error.message).toContain('bootstrap key');
    });

    it('should reject duplicate organization slug with 409 Conflict', async () => {
      jest.spyOn(organizationRepository, 'findBySlug').mockResolvedValueOnce({
        id: 'existing-id',
        name: 'Existing Org',
        slug: 'existing-slug',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const response = await request(app)
        .post('/v1/organizations')
        .send({
          name: 'Another Org',
          slug: 'existing-slug'
        });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('CONFLICT');
    });
  });

  describe('GET /v1/organizations/:organizationId', () => {
    it('should return organization when caller belongs to same organization', async () => {
      jest.spyOn(organizationRepository, 'findById').mockResolvedValueOnce({
        id: org1Id,
        name: 'Org 1',
        slug: 'org-1',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const response = await request(app)
        .get(`/v1/organizations/${org1Id}`)
        .set('Authorization', `Bearer ${org1AdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(org1Id);
      expect(response.body.slug).toBe('org-1');
    });

    it('SECURITY REGRESSION: should reject cross-tenant access when caller requests different organization', async () => {
      // org1AdminToken attempts to access org2Id
      const response = await request(app)
        .get(`/v1/organizations/${org2Id}`)
        .set('Authorization', `Bearer ${org1AdminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(response.body.error.message).toContain('Cross-tenant');
    });
  });

  describe('PATCH /v1/organizations/:organizationId', () => {
    it('should allow organization admin to update permitted fields in their own organization', async () => {
      jest.spyOn(organizationRepository, 'findById').mockResolvedValueOnce({
        id: org1Id,
        name: 'Old Name',
        slug: 'org-1',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      jest.spyOn(organizationRepository, 'update').mockResolvedValueOnce({
        id: org1Id,
        name: 'Updated Name',
        slug: 'org-1',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const response = await request(app)
        .patch(`/v1/organizations/${org1Id}`)
        .set('Authorization', `Bearer ${org1AdminToken}`)
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Name');
    });

    it('SECURITY REGRESSION: should reject cross-tenant organization update', async () => {
      const response = await request(app)
        .patch(`/v1/organizations/${org2Id}`)
        .set('Authorization', `Bearer ${org1AdminToken}`)
        .send({ name: 'Malicious Update' });

      expect(response.status).toBe(403);
    });
  });
});
