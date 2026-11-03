// Authentication Service: Login, Token Rotation, Replay Detection, and Profile Retrieval

import {
  ForbiddenError,
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
import { LoginInput, LogoutInput, RefreshInput } from '../schemas';
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
let DUMMY_HASH = '';
hashPassword('dummy_timing_protection_password').then((h) => {
  DUMMY_HASH = h;
});

export class AuthService {
  constructor(
    private readonly userRepo: UserRepository = defaultUserRepo,
    private readonly orgRepo: OrganizationRepository = defaultOrgRepo,
    private readonly refreshRepo: RefreshTokenRepository = defaultRefreshRepo
  ) {}

  async login(
    input: LoginInput
  ): Promise<{ user: SafeUser; tokens: TokenPair }> {
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
      user: safeUser,
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 900, // 15 minutes in seconds
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
