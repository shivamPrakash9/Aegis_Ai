// Service Account Repository with Tenant Isolation

import {
  PrismaClient,
  ServiceAccount,
  ServiceAccountStatus
} from '@prisma/client';
import { prisma as defaultPrisma } from '../config/database';

export class ServiceAccountRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async findById(id: string, orgId?: string): Promise<ServiceAccount | null> {
    const where: any = { id };
    if (orgId) {
      where.organizationId = orgId;
    }
    return this.prisma.serviceAccount.findFirst({ where });
  }

  async findByKeyPrefix(keyPrefix: string): Promise<ServiceAccount | null> {
    return this.prisma.serviceAccount.findUnique({
      where: { keyPrefix }
    });
  }

  async listByOrganization(
    orgId: string,
    pagination: { skip: number; limit: number }
  ): Promise<{ accounts: ServiceAccount[]; total: number }> {
    const [accounts, total] = await Promise.all([
      this.prisma.serviceAccount.findMany({
        where: { organizationId: orgId },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.serviceAccount.count({
        where: { organizationId: orgId }
      })
    ]);

    return { accounts, total };
  }

  async create(data: {
    organizationId: string;
    name: string;
    keyPrefix: string;
    secretHash: string;
    permissions: string[];
    createdBy?: string;
    expiresAt?: Date;
  }): Promise<ServiceAccount> {
    return this.prisma.serviceAccount.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        keyPrefix: data.keyPrefix,
        secretHash: data.secretHash,
        permissions: JSON.stringify(data.permissions),
        createdBy: data.createdBy,
        expiresAt: data.expiresAt,
        status: 'ACTIVE'
      }
    });
  }

  async updateSecret(
    id: string,
    orgId: string,
    newKeyPrefix: string,
    newSecretHash: string
  ): Promise<ServiceAccount> {
    const account = await this.prisma.serviceAccount.findFirst({
      where: { id, organizationId: orgId }
    });
    if (!account) {
      throw new Error('Service account not found in organization');
    }

    return this.prisma.serviceAccount.update({
      where: { id },
      data: {
        keyPrefix: newKeyPrefix,
        secretHash: newSecretHash,
        status: 'ACTIVE'
      }
    });
  }

  async revoke(id: string, orgId: string): Promise<ServiceAccount> {
    const account = await this.prisma.serviceAccount.findFirst({
      where: { id, organizationId: orgId }
    });
    if (!account) {
      throw new Error('Service account not found in organization');
    }

    return this.prisma.serviceAccount.update({
      where: { id },
      data: { status: 'REVOKED' }
    });
  }

  async updateLastUsed(id: string): Promise<void> {
    await this.prisma.serviceAccount.update({
      where: { id },
      data: { lastUsedAt: new Date() }
    });
  }
}

export const serviceAccountRepository = new ServiceAccountRepository();
