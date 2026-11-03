// Unit Tests: RBAC Permissions and Access Matrix

import {
  ALL_PERMISSIONS,
  getPermissionsForRole,
  hasAllPermissions,
  hasPermission,
  ROLE_PERMISSIONS
} from '../../src/utils/permissions';

describe('Permissions and RBAC Matrix', () => {
  it('should return complete administrative permissions for ORGANIZATION_ADMIN', () => {
    const adminPerms = getPermissionsForRole('ORGANIZATION_ADMIN');
    expect(adminPerms).toEqual(ROLE_PERMISSIONS.ORGANIZATION_ADMIN);
    expect(adminPerms).toContain('users:create');
    expect(adminPerms).toContain('users:disable');
    expect(adminPerms).toContain('service_accounts:create');
    expect(adminPerms).toContain('organization:update');
  });

  it('should return read-only limited permissions for DEVELOPER', () => {
    const devPerms = getPermissionsForRole('DEVELOPER');
    expect(devPerms).toContain('organization:read');
    expect(devPerms).toContain('users:read');
    expect(devPerms).toContain('service_accounts:read');
    expect(devPerms).not.toContain('users:create');
    expect(devPerms).not.toContain('users:disable');
    expect(devPerms).not.toContain('service_accounts:create');
  });

  it('should correctly evaluate single permission check', () => {
    const permissions = getPermissionsForRole('DEVELOPER');
    expect(hasPermission(permissions, 'organization:read')).toBe(true);
    expect(hasPermission(permissions, 'users:disable')).toBe(false);
  });

  it('should correctly evaluate multi-permission requirements', () => {
    const adminPerms = getPermissionsForRole('ORGANIZATION_ADMIN');
    expect(
      hasAllPermissions(adminPerms, ['users:read', 'users:create', 'users:disable'])
    ).toBe(true);

    const devPerms = getPermissionsForRole('DEVELOPER');
    expect(
      hasAllPermissions(devPerms, ['users:read', 'users:create'])
    ).toBe(false);
  });

  it('should return empty array for invalid or unknown roles', () => {
    expect(getPermissionsForRole('UNKNOWN_ROLE' as any)).toEqual([]);
  });

  it('should define ALL_PERMISSIONS containing every registered capability', () => {
    expect(ALL_PERMISSIONS.length).toBeGreaterThan(5);
    expect(ALL_PERMISSIONS).toContain('sessions:verify');
  });
});
