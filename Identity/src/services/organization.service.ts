// Organization Service

import { Organization, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../config/database';
import { config } from '../config/env';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError
} from '../middleware/errorHandler';
import {
  OrganizationRepository,
  organizationRepository as defaultOrgRepo
} from '../repositories/organization.repository';
import { CreateOrganizationInput, UpdateOrganizationInput } from '../schemas';
import { AuthenticatedPrincipal, SafeOrganization } from '../types';
import { hashPassword } from '../utils/crypto';
import { signAccessToken } from '../utils/jwt';
import { getPermissionsForRole } from '../utils/permissions';

export class OrganizationService {
  constructor(
    private readonly orgRepo: OrganizationRepository = defaultOrgRepo,
    private readonly prisma: PrismaClient = defaultPrisma
  ) {}

  async createOrganization(
    input: CreateOrganizationInput
  ): Promise<{
    organization: SafeOrganization;
    adminUser?: { id: string; email: string; displayName: string };
    accessToken?: string;
  }> {
    // Check if slug is already taken
    const existing = await this.orgRepo.findBySlug(input.slug);
    if (existing) {
      throw new ConflictError(`Organization slug '${input.slug}' is already taken.`);
    }

    // Verify bootstrap security: if initial admin creation is requested via API, verify bootstrap key
    if (input.adminUser) {
      if (!input.bootstrapKey || input.bootstrapKey !== config.adminBootstrapKey) {
        throw new UnauthorizedError('Invalid or missing administrative bootstrap key.');
      }
    }

    // Atomic transaction for Organization + Initial Admin User
    return await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: input.name,
          slug: input.slug.toLowerCase(),
          status: 'ACTIVE'
        }
      });

      let adminUser: { id: string; email: string; displayName: string } | undefined;
      let accessToken: string | undefined;

      if (input.adminUser) {
        // Check if email already in use globally
        const existingUser = await tx.user.findUnique({
          where: { email: input.adminUser.email.toLowerCase() }
        });
        if (existingUser) {
          throw new ConflictError(`User with email '${input.adminUser.email}' already exists.`);
        }

        const passwordHash = await hashPassword(input.adminUser.password);
        const createdUser = await tx.user.create({
          data: {
            organizationId: org.id,
            email: input.adminUser.email.toLowerCase(),
            passwordHash,
            displayName: input.adminUser.displayName,
            role: 'ORGANIZATION_ADMIN',
            status: 'ACTIVE'
          }
        });

        adminUser = {
          id: createdUser.id,
          email: createdUser.email,
          displayName: createdUser.displayName
        };

        const principal: AuthenticatedPrincipal = {
          id: createdUser.id,
          organizationId: org.id,
          type: 'USER',
          email: createdUser.email,
          displayName: createdUser.displayName,
          role: 'ORGANIZATION_ADMIN',
          permissions: getPermissionsForRole('ORGANIZATION_ADMIN')
        };

        accessToken = signAccessToken(principal);
      }

      return {
        organization: this.formatOrganization(org),
        adminUser,
        accessToken
      };
    });
  }

  async getOrganization(
    principal: AuthenticatedPrincipal,
    orgId: string
  ): Promise<SafeOrganization> {
    // Tenant isolation: caller can only retrieve their own organization
    if (principal.organizationId !== orgId) {
      throw new ForbiddenError('Cross-tenant access forbidden.');
    }

    const org = await this.orgRepo.findById(orgId);
    if (!org) {
      throw new NotFoundError('Organization not found.');
    }

    return this.formatOrganization(org);
  }

  async updateOrganization(
    principal: AuthenticatedPrincipal,
    orgId: string,
    input: UpdateOrganizationInput
  ): Promise<SafeOrganization> {
    // Tenant isolation
    if (principal.organizationId !== orgId) {
      throw new ForbiddenError('Cross-tenant access forbidden.');
    }

    const existing = await this.orgRepo.findById(orgId);
    if (!existing) {
      throw new NotFoundError('Organization not found.');
    }

    const updated = await this.orgRepo.update(orgId, input);
    return this.formatOrganization(updated);
  }

  private formatOrganization(org: Organization): SafeOrganization {
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: org.status as any,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt
    };
  }
}

export const organizationService = new OrganizationService();
