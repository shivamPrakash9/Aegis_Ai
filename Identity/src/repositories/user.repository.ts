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
    pagination: { skip: number; limit: number }
  ): Promise<{ users: User[]; total: number }> {
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { organizationId: orgId },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.user.count({
        where: { organizationId: orgId }
      })
    ]);

    return { users, total };
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

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() }
    });
  }
}

export const userRepository = new UserRepository();
