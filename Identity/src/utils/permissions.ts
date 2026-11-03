// Role-Based Access Control (RBAC) Permission Definitions and Utilities

import { Permission, UserRole } from '../types';

export const ALL_PERMISSIONS: Permission[] = [
  'organization:read',
  'organization:update',
  'users:read',
  'users:create',
  'users:update',
  'users:disable',
  'service_accounts:read',
  'service_accounts:create',
  'service_accounts:rotate',
  'service_accounts:revoke',
  'service_accounts:disable',
  'sessions:verify'
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ORGANIZATION_ADMIN: [
    'organization:read',
    'organization:update',
    'users:read',
    'users:create',
    'users:update',
    'users:disable',
    'service_accounts:read',
    'service_accounts:create',
    'service_accounts:rotate',
    'service_accounts:revoke',
    'service_accounts:disable',
    'sessions:verify'
  ],
  DEVELOPER: [
    'organization:read',
    'users:read',
    'service_accounts:read'
  ],
  SECURITY_AUDITOR: [
    'organization:read',
    'users:read',
    'service_accounts:read'
  ]
};

export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function hasPermission(userPermissions: Permission[], requiredPermission: Permission): boolean {
  return userPermissions.includes(requiredPermission);
}

export function hasAllPermissions(userPermissions: Permission[], requiredPermissions: Permission[]): boolean {
  return requiredPermissions.every((perm) => userPermissions.includes(perm));
}
