// User Repository with Strict Tenant Isolation

import { PrismaClient, User, UserRole, UserStatus } from '@prisma/client';
import { prisma as defaultPrisma } from '../config/database';

export class UserRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async findById(id: string, orgId?: string): Promise<User | null> {
    const where: any = { id };
    if (orgId) {
      where.organizationId = orgId;
    }
    return this.prisma.user.findFirst({ where });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });
  }

  async listByOrganization(
    orgId: string,
    pagination: {
      skip: number;
      limit: number;
      search?: string;
      role?: UserRole;
      status?: UserStatus;
    }
  ): Promise<{ users: User[]; total: number }> {
    const where: any = { organizationId: orgId };
    if (pagination.role) {
      where.role = pagination.role;
    }
    if (pagination.status) {
      where.status = pagination.status;
    }
    if (pagination.search && pagination.search.trim()) {
      const term = pagination.search.trim();
      where.OR = [
        { displayName: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } }
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.user.count({ where })
    ]);

    return { users, total };
  }

  async getStatsByOrganization(orgId: string): Promise<{
    total: number;
    developers: number;
    auditors: number;
    admins: number;
  }> {
    const [total, developers, auditors, admins] = await Promise.all([
      this.prisma.user.count({
        where: { organizationId: orgId }
      }),
      this.prisma.user.count({
        where: { organizationId: orgId, role: 'DEVELOPER' }
      }),
      this.prisma.user.count({
        where: { organizationId: orgId, role: 'SECURITY_AUDITOR' }
      }),
      this.prisma.user.count({
        where: { organizationId: orgId, role: 'ORGANIZATION_ADMIN' }
      })
    ]);

    return { total, developers, auditors, admins };
  }

  async create(data: {
    organizationId: string;
    email: string;
    passwordHash: string;
    displayName: string;
    role?: UserRole;
    status?: UserStatus;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        organizationId: data.organizationId,
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        displayName: data.displayName,
        role: data.role || 'DEVELOPER',
        status: data.status || 'ACTIVE'
      }
    });
  }

  async update(
    id: string,
    orgId: string,
    data: {
      displayName?: string;
      role?: UserRole;
      status?: UserStatus;
      passwordHash?: string;
      lastLoginAt?: Date;
    }
  ): Promise<User> {
    // Enforce tenant isolation in where condition
    const user = await this.prisma.user.findFirst({
      where: { id, organizationId: orgId }
    });
    if (!user) {
      throw new Error('User not found in organization');
    }

    return this.prisma.user.update({
      where: { id },
      data
    });
  }

  async disable(id: string, orgId: string): Promise<User> {
    return this.update(id, orgId, { status: 'INACTIVE' });
  }

  async deleteUser(id: string, orgId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id, organizationId: orgId }
    });
    if (!user) {
      throw new Error('User not found in organization');
    }
    await this.prisma.user.delete({
      where: { id }
    });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() }
    });
  }
}

export const userRepository = new UserRepository();
