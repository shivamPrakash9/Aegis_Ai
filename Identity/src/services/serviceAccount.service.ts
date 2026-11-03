// Service Account Management Service

import { ServiceAccount } from '@prisma/client';
import { ForbiddenError, NotFoundError } from '../middleware/errorHandler';
import {
  ServiceAccountRepository,
  serviceAccountRepository as defaultSaRepo
} from '../repositories/serviceAccount.repository';
import { CreateServiceAccountInput, PaginationQuery } from '../schemas';
import {
  AuthenticatedPrincipal,
  Permission,
  SafeServiceAccount,
  ServiceAccountWithSecret
} from '../types';
import { generateServiceAccountKey } from '../utils/crypto';

export class ServiceAccountService {
  constructor(
    private readonly saRepo: ServiceAccountRepository = defaultSaRepo
  ) {}

  async createServiceAccount(
    principal: AuthenticatedPrincipal,
    input: CreateServiceAccountInput
  ): Promise<ServiceAccountWithSecret> {
    const orgId = principal.organizationId;

    // Privilege escalation check: cannot grant permissions the caller doesn't have
    const callerPermissions = principal.permissions || [];
    const invalidPermissions = input.permissions.filter(
      (p) => !callerPermissions.includes(p as Permission)
    );
    if (invalidPermissions.length > 0) {
      throw new ForbiddenError(
        'Cannot grant permissions that the caller does not possess.',
        { invalidPermissions }
      );
    }

    const { apiKey, keyPrefix, secretHash } = generateServiceAccountKey();

    const sa = await this.saRepo.create({
      organizationId: orgId,
      name: input.name,
      keyPrefix,
      secretHash,
      permissions: input.permissions,
      createdBy: principal.id
    });

    return {
      ...this.formatServiceAccount(sa),
      apiKey // Returned ONLY ONCE upon creation
    };
  }

  async listServiceAccounts(
    principal: AuthenticatedPrincipal,
    query: PaginationQuery
  ): Promise<{ accounts: SafeServiceAccount[]; total: number; page: number; limit: number }> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const { accounts, total } = await this.saRepo.listByOrganization(
      principal.organizationId,
      { skip, limit }
    );

    return {
      accounts: accounts.map(this.formatServiceAccount),
      total,
      page,
      limit
    };
  }

  async getServiceAccount(
    principal: AuthenticatedPrincipal,
    serviceAccountId: string
  ): Promise<SafeServiceAccount> {
    const sa = await this.saRepo.findById(serviceAccountId, principal.organizationId);
    if (!sa) {
      throw new NotFoundError('Service account not found.');
    }

    return this.formatServiceAccount(sa);
  }

  async rotateServiceAccount(
    principal: AuthenticatedPrincipal,
    serviceAccountId: string
  ): Promise<ServiceAccountWithSecret> {
    const sa = await this.saRepo.findById(serviceAccountId, principal.organizationId);
    if (!sa) {
      throw new NotFoundError('Service account not found.');
    }

    const { apiKey, keyPrefix, secretHash } = generateServiceAccountKey();
    const updated = await this.saRepo.updateSecret(
      serviceAccountId,
      principal.organizationId,
      keyPrefix,
      secretHash
    );

    return {
      ...this.formatServiceAccount(updated),
      apiKey
    };
  }

  async revokeServiceAccount(
    principal: AuthenticatedPrincipal,
    serviceAccountId: string
  ): Promise<SafeServiceAccount> {
    const sa = await this.saRepo.findById(serviceAccountId, principal.organizationId);
    if (!sa) {
      throw new NotFoundError('Service account not found.');
    }

    const updated = await this.saRepo.revoke(serviceAccountId, principal.organizationId);
    return this.formatServiceAccount(updated);
  }

  private formatServiceAccount(sa: ServiceAccount): SafeServiceAccount {
    let permissions: Permission[] = [];
    try {
      permissions = JSON.parse(sa.permissions);
    } catch {
      permissions = [];
    }

    return {
      id: sa.id,
      organizationId: sa.organizationId,
      name: sa.name,
      keyPrefix: sa.keyPrefix,
      permissions,
      status: sa.status as any,
      createdBy: sa.createdBy,
      lastUsedAt: sa.lastUsedAt,
      expiresAt: sa.expiresAt,
      createdAt: sa.createdAt,
      updatedAt: sa.updatedAt
    };
  }
}

export const serviceAccountService = new ServiceAccountService();
