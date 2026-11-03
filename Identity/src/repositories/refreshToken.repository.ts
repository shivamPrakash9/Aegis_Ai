// Refresh Token Repository for Session Lifecycle & Replay Detection

import { PrismaClient, RefreshToken } from '@prisma/client';
import { prisma as defaultPrisma } from '../config/database';

export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async create(data: {
    userId: string;
    organizationId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
  }): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({
      data: {
        userId: data.userId,
        organizationId: data.organizationId,
        tokenHash: data.tokenHash,
        familyId: data.familyId,
        expiresAt: data.expiresAt,
        isRevoked: false
      }
    });
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: true,
        organization: true
      }
    });
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { isRevoked: true }
    });
  }

  /**
   * Revoke entire family when replay attack is detected
   */
  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId },
      data: { isRevoked: true }
    });
  }

  /**
   * Revoke all refresh tokens for a user (e.g. account disabled or full logout)
   */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { isRevoked: true }
    });
  }
}

export const refreshTokenRepository = new RefreshTokenRepository();
