// User Management Service with Multi-Tenant Scoping and Privilege Escalation Protection

import { User } from '@prisma/client';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError
} from '../middleware/errorHandler';
import {
  RefreshTokenRepository,
  refreshTokenRepository as defaultRefreshRepo
} from '../repositories/refreshToken.repository';
import {
  UserRepository,
  userRepository as defaultUserRepo
} from '../repositories/user.repository';
import { CreateUserInput, PaginationQuery, UpdateUserInput } from '../schemas';
import { AuthenticatedPrincipal, SafeUser } from '../types';
import { hashPassword } from '../utils/crypto';

export class UserService {
  constructor(
    private readonly userRepo: UserRepository = defaultUserRepo,
    private readonly refreshRepo: RefreshTokenRepository = defaultRefreshRepo
  ) {}

  async createUser(
    principal: AuthenticatedPrincipal,
    input: CreateUserInput
  ): Promise<SafeUser> {
    const orgId = principal.organizationId;

    // Privilege escalation check: only ORGANIZATION_ADMIN can create an admin
    if (input.role === 'ORGANIZATION_ADMIN' && principal.role !== 'ORGANIZATION_ADMIN') {
      throw new ForbiddenError('Only Organization Admins can create administrative users.');
    }

    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = await this.userRepo.findByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictError(`User with email '${input.email}' already exists.`);
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.userRepo.create({
      organizationId: orgId,
      email: normalizedEmail,
      passwordHash,
      displayName: input.displayName,
      role: input.role || 'DEVELOPER',
      status: 'ACTIVE'
    });

    return this.formatUser(user);
  }

  async listUsers(
    principal: AuthenticatedPrincipal,
    query: PaginationQuery
  ): Promise<{
    success: boolean;
    users: SafeUser[];
    data: SafeUser[];
    total: number;
    page: number;
    limit: number;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const page = Math.max(1, parseInt(String(query.page || 1), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(query.limit || 20), 10) || 20));
    const skip = (page - 1) * limit;

    const { users, total } = await this.userRepo.listByOrganization(
      principal.organizationId,
      {
        skip,
        limit,
        search: query.search ? String(query.search).trim() : undefined,
        role: query.role as any,
        status: query.status as any
      }
    );

    const totalPages = Math.ceil(total / limit) || 1;
    const formatted = users.map(this.formatUser);

    return {
      success: true,
      users: formatted,
      data: formatted,
      total,
      page,
      limit,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    };
  }

  async getUserStats(
    principal: AuthenticatedPrincipal
  ): Promise<{
    success: boolean;
    data: {
      total: number;
      developers: number;
      auditors: number;
      admins: number;
    };
    total: number;
    developers: number;
    auditors: number;
    admins: number;
  }> {
    const stats = await this.userRepo.getStatsByOrganization(principal.organizationId);
    return {
      success: true,
      data: stats,
      ...stats
    };
  }

  async getUser(
    principal: AuthenticatedPrincipal,
    userId: string
  ): Promise<SafeUser> {
    const user = await this.userRepo.findById(userId, principal.organizationId);
    if (!user) {
      throw new NotFoundError('User not found.');
    }

    return this.formatUser(user);
  }

  async updateUser(
    principal: AuthenticatedPrincipal,
    userId: string,
    input: UpdateUserInput
  ): Promise<SafeUser> {
    const user = await this.userRepo.findById(userId, principal.organizationId);
    if (!user) {
      throw new NotFoundError('User not found.');
    }

    // Privilege escalation protection: only admin can modify roles
    if (input.role && input.role !== user.role) {
      if (principal.role !== 'ORGANIZATION_ADMIN') {
        throw new ForbiddenError('Only Organization Admins can modify user roles.');
      }
    }

    const updated = await this.userRepo.update(userId, principal.organizationId, {
      displayName: input.displayName,
      role: input.role,
      status: input.status
    });

    return this.formatUser(updated);
  }

  async disableUser(
    principal: AuthenticatedPrincipal,
    userId: string
  ): Promise<SafeUser> {
    const user = await this.userRepo.findById(userId, principal.organizationId);
    if (!user) {
      throw new NotFoundError('User not found.');
    }

    // Disable account
    const disabled = await this.userRepo.disable(userId, principal.organizationId);

    // Revoke all active refresh sessions for this user
    await this.refreshRepo.revokeAllForUser(userId);

    return this.formatUser(disabled);
  }

  async deleteUser(
    principal: AuthenticatedPrincipal,
    userId: string
  ): Promise<void> {
    if (principal.role !== 'ORGANIZATION_ADMIN') {
      throw new ForbiddenError('Only Organization Admins can remove organization members.');
    }
    if (principal.id === userId) {
      throw new ForbiddenError('Cannot remove yourself as an organization admin.');
    }
    const user = await this.userRepo.findById(userId, principal.organizationId);
    if (!user) {
      throw new NotFoundError('User not found.');
    }
    await this.refreshRepo.revokeAllForUser(userId);
    await this.userRepo.deleteUser(userId, principal.organizationId);
  }

  private formatUser(user: User): SafeUser {
    return {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      displayName: user.displayName,
      role: user.role as any,
      status: user.status as any,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
  }
}

export const userService = new UserService();
