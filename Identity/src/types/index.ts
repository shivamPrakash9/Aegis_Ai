// Core TypeScript Types & Interfaces for AegisAI Identity Service

export type UserRole = 'ORGANIZATION_ADMIN' | 'DEVELOPER' | 'SECURITY_AUDITOR';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type OrganizationStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export type ServiceAccountStatus = 'ACTIVE' | 'INACTIVE' | 'REVOKED';

export type PrincipalType = 'USER' | 'SERVICE_ACCOUNT';

export type Permission =
  | 'organization:read'
  | 'organization:update'
  | 'users:read'
  | 'users:create'
  | 'users:update'
  | 'users:disable'
  | 'service_accounts:read'
  | 'service_accounts:create'
  | 'service_accounts:rotate'
  | 'service_accounts:revoke'
  | 'service_accounts:disable'
  | 'sessions:verify';

export interface AuthenticatedPrincipal {
  id: string;
  organizationId: string;
  type: PrincipalType;
  email?: string;
  displayName?: string;
  role?: UserRole;
  permissions: Permission[];
}

export interface AccessTokenPayload {
  sub: string;
  iss: string;
  aud: string;
  iat?: number;
  exp?: number;
  jti: string;
  org_id: string;
  type: PrincipalType;
  email?: string;
  displayName?: string;
  role?: UserRole;
  permissions: Permission[];
}

export interface RefreshTokenPayload {
  sub: string;
  iss: string;
  aud: string;
  jti: string;
  org_id: string;
  family_id: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    correlationId: string;
    details?: unknown;
  };
}

export interface SafeUser {
  id: string;
  organizationId: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SafeOrganization {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface SafeServiceAccount {
  id: string;
  organizationId: string;
  name: string;
  keyPrefix: string;
  permissions: Permission[];
  status: ServiceAccountStatus;
  createdBy: string | null;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceAccountWithSecret extends SafeServiceAccount {
  apiKey: string; // Provided only once on creation/rotation
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}
