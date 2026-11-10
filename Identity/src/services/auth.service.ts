// Authentication Service: Login, Token Rotation, Replay Detection, and Profile Retrieval

import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../config/database';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError
} from '../middleware/errorHandler';
import {
  OrganizationRepository,
  organizationRepository as defaultOrgRepo
} from '../repositories/organization.repository';
import {
  RefreshTokenRepository,
  refreshTokenRepository as defaultRefreshRepo
} from '../repositories/refreshToken.repository';
import {
  UserRepository,
  userRepository as defaultUserRepo
} from '../repositories/user.repository';
import { LoginInput, LogoutInput, RefreshInput, RegisterInput } from '../schemas';
import {
  AuthenticatedPrincipal,
  SafeUser,
  TokenPair
} from '../types';
import { hashPassword, hashSha256, verifyPassword } from '../utils/crypto';
import { createRefreshToken, signAccessToken } from '../utils/jwt';
import { logger } from '../utils/logger';
import { getPermissionsForRole } from '../utils/permissions';

// Precomputed dummy hash to prevent timing attacks during non-existent user login
let DUMMY_HASH = '$argon2id$v=19$m=65536,t=3,p=4$ZHVtbXlfc2FsdF9mb3JfdGltaW5n$dGVzdF9kdW1teV9oYXNoX2Zvcl90aW1pbmdfcHJvdGVjdGlvbg';
hashPassword('dummy_timing_protection_password').then((h) => {
  DUMMY_HASH = h;
}).catch(() => {});

export class AuthService {
  constructor(
    private readonly userRepo: UserRepository = defaultUserRepo,
    private readonly orgRepo: OrganizationRepository = defaultOrgRepo,
    private readonly refreshRepo: RefreshTokenRepository = defaultRefreshRepo,
    private readonly prisma: PrismaClient = defaultPrisma
  ) {}

  async login(
    input: LoginInput
  ): Promise<{ user: SafeUser; tokens: TokenPair; success?: boolean }> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const user = await this.userRepo.findByEmail(normalizedEmail);

    // Timing-attack mitigation
    const passwordToVerify = user ? user.passwordHash : DUMMY_HASH;
    const isPasswordValid = await verifyPassword(input.password, passwordToVerify);

    if (!user || !isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedError('Account is inactive or suspended.');
    }

    const org = await this.orgRepo.findById(user.organizationId);
    if (!org || org.status !== 'ACTIVE') {
      throw new UnauthorizedError('Organization is inactive or suspended.');
    }

    // Update last login timestamp asynchronously
    this.userRepo.updateLastLogin(user.id).catch(() => {});

    const permissions = getPermissionsForRole(user.role as any);
    const principal: AuthenticatedPrincipal = {
      id: user.id,
      organizationId: user.organizationId,
      type: 'USER',
      email: user.email,
      displayName: user.displayName,
      role: user.role as any,
      permissions
    };

    const accessToken = signAccessToken(principal);
    const { refreshToken, tokenHash, familyId, expiresAt } =
      createRefreshToken(user.id, user.organizationId);

    await this.refreshRepo.create({
      userId: user.id,
      organizationId: user.organizationId,
      tokenHash,
      familyId,
      expiresAt
    });

    const safeUser: SafeUser = {
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

    return {
      success: true,
      user: safeUser,
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 900, // 15 minutes in seconds
        tokenType: 'Bearer'
      }
    };
  }

  async register(
    input: RegisterInput
  ): Promise<{ user: SafeUser; tokens: TokenPair; success?: boolean }> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = await this.userRepo.findByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictError(`User with email '${normalizedEmail}' already exists.`);
    }

    let organizationId = input.organizationId;
    let assignedRole: 'ORGANIZATION_ADMIN' | 'DEVELOPER' = 'DEVELOPER';

    if (organizationId) {
      const org = await this.orgRepo.findById(organizationId);
      if (!org || org.status !== 'ACTIVE') {
        throw new NotFoundError('Organization not found or inactive.');
      }
    } else if (input.organizationName && input.organizationName.trim()) {
      const orgName = input.organizationName.trim();
      const slug = orgName
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50);

      let existingOrg = await this.orgRepo.findBySlug(slug);
      if (!existingOrg) {
        existingOrg = await this.prisma.organization.findFirst({
          where: {
            OR: [
              { name: { equals: orgName, mode: 'insensitive' } },
              { slug: { equals: slug, mode: 'insensitive' } }
            ]
          }
        });
      }

      if (existingOrg) {
        if (existingOrg.status !== 'ACTIVE') {
          throw new UnauthorizedError('Organization is inactive.');
        }
        organizationId = existingOrg.id;
        assignedRole = 'DEVELOPER';
      } else {
        const createdOrg = await this.orgRepo.create({
          name: orgName,
          slug: slug || `org-${Date.now()}`
        });
        organizationId = createdOrg.id;
        assignedRole = 'ORGANIZATION_ADMIN';
      }
    } else {
      // Default to primary enterprise organization
      let defaultOrg = await this.orgRepo.findBySlug('org_enterprise_alpha');
      if (!defaultOrg) {
        defaultOrg = await this.orgRepo.create({
          name: 'Enterprise Alpha Corp',
          slug: 'org_enterprise_alpha'
        });
      }
      organizationId = defaultOrg.id;
      assignedRole = 'DEVELOPER';
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.userRepo.create({
      organizationId,
      email: normalizedEmail,
      passwordHash,
      displayName: input.displayName.trim(),
      role: assignedRole
    });

    const permissions = getPermissionsForRole(user.role as any);
    const principal: AuthenticatedPrincipal = {
      id: user.id,
      organizationId: user.organizationId,
      type: 'USER',
      email: user.email,
      displayName: user.displayName,
      role: user.role as any,
      permissions
    };

    const accessToken = signAccessToken(principal);
    const { refreshToken, tokenHash, familyId, expiresAt } =
      createRefreshToken(user.id, user.organizationId);

    await this.refreshRepo.create({
      userId: user.id,
      organizationId: user.organizationId,
      tokenHash,
      familyId,
      expiresAt
    });

    const safeUser: SafeUser = {
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

    return {
      success: true,
      user: safeUser,
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 900,
        tokenType: 'Bearer'
      }
    };
  }

  async refresh(input: RefreshInput): Promise<{ tokens: TokenPair }> {
    const tokenHash = hashSha256(input.refreshToken);
    const storedToken = await this.refreshRepo.findByTokenHash(tokenHash);

    if (!storedToken) {
      throw new UnauthorizedError('Invalid refresh token.');
    }

    // REPLAY ATTACK DETECTION
    if (storedToken.isRevoked) {
      logger.warn(
        { familyId: storedToken.familyId, userId: storedToken.userId },
        'SECURITY ALERT: Revoked refresh token reuse detected. Revoking entire token family.'
      );
      await this.refreshRepo.revokeFamily(storedToken.familyId);
      throw new UnauthorizedError('Invalid refresh token. Compromised session revoked.');
    }

    if (storedToken.expiresAt.getTime() < Date.now()) {
      await this.refreshRepo.revoke(storedToken.id);
      throw new UnauthorizedError('Refresh token has expired.');
    }

    const user = await this.userRepo.findById(storedToken.userId);
    if (!user || user.status !== 'ACTIVE') {
      await this.refreshRepo.revokeFamily(storedToken.familyId);
      throw new UnauthorizedError('User account is inactive or disabled.');
    }

    const org = await this.orgRepo.findById(storedToken.organizationId);
    if (!org || org.status !== 'ACTIVE') {
      await this.refreshRepo.revokeFamily(storedToken.familyId);
      throw new UnauthorizedError('Organization is inactive or disabled.');
    }

    // Rotate: Revoke old token and create new one in the same family
    await this.refreshRepo.revoke(storedToken.id);

    const { refreshToken: newRawToken, tokenHash: newHash, familyId, expiresAt } =
      createRefreshToken(user.id, user.organizationId, storedToken.familyId);

    await this.refreshRepo.create({
      userId: user.id,
      organizationId: user.organizationId,
      tokenHash: newHash,
      familyId,
      expiresAt
    });

    const permissions = getPermissionsForRole(user.role as any);
    const principal: AuthenticatedPrincipal = {
      id: user.id,
      organizationId: user.organizationId,
      type: 'USER',
      email: user.email,
      displayName: user.displayName,
      role: user.role as any,
      permissions
    };

    const newAccessToken = signAccessToken(principal);

    return {
      tokens: {
        accessToken: newAccessToken,
        refreshToken: newRawToken,
        expiresIn: 900,
        tokenType: 'Bearer'
      }
    };
  }

  async logout(input: LogoutInput): Promise<void> {
    const tokenHash = hashSha256(input.refreshToken);
    const storedToken = await this.refreshRepo.findByTokenHash(tokenHash);
    if (storedToken) {
      // Revoke the session family
      await this.refreshRepo.revokeFamily(storedToken.familyId);
    }
  }

  async getMe(principal: AuthenticatedPrincipal): Promise<AuthenticatedPrincipal> {
    return principal;
  }
}

export const authService = new AuthService();
