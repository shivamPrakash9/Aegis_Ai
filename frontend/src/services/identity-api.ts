// Identity Management API Client (Users & Organizations)

import { request, API_CONFIG } from './api-client';
import type { SafeUser, Organization, UserRole } from '../types';

export interface UserListResponse {
  success?: boolean;
  users: SafeUser[];
  data?: SafeUser[];
  total: number;
  page?: number;
  limit?: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UserStatsResponse {
  success?: boolean;
  total: number;
  developers: number;
  auditors: number;
  admins: number;
}

export interface CreateOrganizationPayload {
  name: string;
  slug: string;
  bootstrapKey?: string;
  adminUser?: {
    email: string;
    password: string;
    displayName: string;
  };
}

export interface CreateOrganizationResponse {
  organization: Organization;
  adminUser?: {
    id: string;
    email: string;
    displayName: string;
  };
  accessToken?: string;
}

export const identityApi = {
  listUsers: async (
    page = 1,
    limit = 50,
    options?: { search?: string; role?: string; status?: string }
  ): Promise<UserListResponse> => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (options?.search && options.search.trim()) {
      params.set('search', options.search.trim());
    }
    if (options?.role && options.role !== 'ALL') {
      params.set('role', options.role);
    }
    if (options?.status && options.status !== 'ALL') {
      params.set('status', options.status);
    }
    return request<UserListResponse>(API_CONFIG.identity, `/v1/users?${params.toString()}`);
  },

  getUserStats: async (): Promise<UserStatsResponse> => {
    return request<UserStatsResponse>(API_CONFIG.identity, '/v1/users/stats');
  },

  createUser: async (user: {
    email: string;
    password: string;
    displayName: string;
    role?: UserRole;
    organizationId?: string;
  }): Promise<SafeUser> => {
    return request<SafeUser>(API_CONFIG.identity, '/v1/users', {
      method: 'POST',
      body: JSON.stringify(user)
    });
  },

  updateUser: async (
    userId: string,
    updates: { displayName?: string; role?: UserRole; status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' }
  ): Promise<SafeUser> => {
    return request<SafeUser>(API_CONFIG.identity, `/v1/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  },

  disableUser: async (userId: string): Promise<SafeUser> => {
    return request<SafeUser>(API_CONFIG.identity, `/v1/users/${encodeURIComponent(userId)}/disable`, {
      method: 'POST'
    });
  },

  deleteUser: async (userId: string): Promise<{ success: boolean; message: string }> => {
    return request<{ success: boolean; message: string }>(API_CONFIG.identity, `/v1/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE'
    });
  },

  getOrganization: async (orgId: string): Promise<Organization> => {
    return request<Organization>(API_CONFIG.identity, `/v1/organizations/${encodeURIComponent(orgId)}`);
  },

  updateOrganization: async (
    orgId: string,
    updates: { name?: string; status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' }
  ): Promise<Organization> => {
    return request<Organization>(API_CONFIG.identity, `/v1/organizations/${encodeURIComponent(orgId)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  },

  createOrganization: async (
    payload: CreateOrganizationPayload
  ): Promise<CreateOrganizationResponse> => {
    return request<CreateOrganizationResponse>(API_CONFIG.identity, '/v1/organizations', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
};
