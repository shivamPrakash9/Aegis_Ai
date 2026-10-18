// Session & Token Verification Service for AI Gateway and Inter-Service Calls

import { UnauthorizedError } from '../middleware/errorHandler';
import {
  OrganizationRepository,
  organizationRepository as defaultOrgRepo
} from '../repositories/organization.repository';
import {
  ServiceAccountRepository,
  serviceAccountRepository as defaultSaRepo
} from '../repositories/serviceAccount.repository';
import {
  UserRepository,
  userRepository as defaultUserRepo
} from '../repositories/user.repository';
import { AuthenticatedPrincipal, Permission } from '../types';
import { parseAndVerifyApiKey } from '../utils/crypto';
import { verifyAccessToken } from '../utils/jwt';

export interface VerifiedSessionResponse {
  valid: true;
  principal: {
    id: string;
    organizationId: string;
    type: 'USER' | 'SERVICE_ACCOUNT';
    email?: string;
    displayName?: string;
    role?: string;
    permissions: Permission[];
  };
  expiresAt?: string;
}

export class SessionService {
  constructor(
    private readonly saRepo: ServiceAccountRepository = defaultSaRepo,
    private readonly userRepo: UserRepository = defaultUserRepo,
    private readonly orgRepo: OrganizationRepository = defaultOrgRepo
  ) {}

  async verifyCredential(rawCredential: string): Promise<VerifiedSessionResponse> {
    const credential = rawCredential.trim();

    // Check if Service Account API Key
    if (credential.startsWith('aegis_sa_')) {
      const parts = credential.split('_');
      if (parts.length < 4) {
        throw new UnauthorizedError('Invalid service account key structure.');
      }

      const keyPrefix = `aegis_sa_${parts[2]}`;
      const sa = await this.saRepo.findByKeyPrefix(keyPrefix);

      if (!sa || sa.status !== 'ACTIVE') {
        throw new UnauthorizedError('Service account is inactive, revoked, or not found.');
      }

      if (sa.expiresAt && sa.expiresAt.getTime() < Date.now()) {
        throw new UnauthorizedError('Service account key has expired.');
      }

      const isMatch = parseAndVerifyApiKey(credential, sa.secretHash);
      if (!isMatch) {
        throw new UnauthorizedError('Invalid service account secret key.');
      }

      const org = await this.orgRepo.findById(sa.organizationId);
      if (!org || org.status !== 'ACTIVE') {
        throw new UnauthorizedError('Organization is inactive or suspended.');
      }

      // Update last used
      this.saRepo.updateLastUsed(sa.id).catch(() => {});

      let permissions: Permission[] = [];
      try {
        permissions = JSON.parse(sa.permissions);
      } catch {
        permissions = [];
      }

      return {
        valid: true,
        principal: {
          id: sa.id,
          organizationId: sa.organizationId,
          type: 'SERVICE_ACCOUNT',
          displayName: sa.name,
          permissions
        },
        expiresAt: sa.expiresAt ? sa.expiresAt.toISOString() : undefined
      };
    }

    // JWT Access Token flow
    try {
      const payload = verifyAccessToken(credential);

      // Verify that user and organization are still active
      const user = await this.userRepo.findById(payload.sub, payload.org_id);
      if (!user || user.status !== 'ACTIVE') {
        throw new UnauthorizedError('User account is inactive or disabled.');
      }

      const org = await this.orgRepo.findById(payload.org_id);
      if (!org || org.status !== 'ACTIVE') {
        throw new UnauthorizedError('Organization is inactive or disabled.');
      }

      return {
        valid: true,
        principal: {
          id: payload.sub,
          organizationId: payload.org_id,
          type: payload.type,
          email: payload.email,
          displayName: payload.displayName,
          role: payload.role,
          permissions: payload.permissions || []
        },
        expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : undefined
      };
    } catch (err: any) {
      if (err instanceof UnauthorizedError) {
        throw err;
      }
      throw new UnauthorizedError('Credential verification failed: invalid or expired token.');
    }
  }
}

export const sessionService = new SessionService();
