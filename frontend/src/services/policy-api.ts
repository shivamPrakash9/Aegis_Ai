// Policy & Approval Service API Client

import { request, API_CONFIG } from './api-client';
import type {
  Policy,
  PolicyRule,
  ApprovalRequest
} from '../types';

export interface ListPoliciesFilter {
  limit?: number;
  offset?: number;
  status?: string;
  category?: string;
}

export interface ListApprovalsFilter {
  page?: number;
  limit?: number;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
}

export interface ApprovalListResponse {
  items: ApprovalRequest[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PolicyListResponse {
  items: Policy[];
  total: number;
}

export const policyApi = {
  listPolicies: async (filter: ListPoliciesFilter = {}): Promise<PolicyListResponse> => {
    const params = new URLSearchParams();
    if (filter.limit) params.set('limit', String(filter.limit));
    if (filter.offset !== undefined) params.set('offset', String(filter.offset));
    if (filter.status) params.set('status', filter.status);
    if (filter.category) params.set('category', filter.category);

    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<PolicyListResponse>(API_CONFIG.policy, `/v1/policies${qs}`);
  },

  getPolicy: async (id: string): Promise<Policy> => {
    return request<Policy>(API_CONFIG.policy, `/v1/policies/${encodeURIComponent(id)}`);
  },

  createPolicy: async (policy: {
    name: string;
    description?: string;
    rules: PolicyRule[];
  }): Promise<Policy> => {
    return request<Policy>(API_CONFIG.policy, '/v1/policies', {
      method: 'POST',
      body: JSON.stringify(policy)
    });
  },

  activatePolicy: async (id: string): Promise<Policy> => {
    return request<Policy>(API_CONFIG.policy, `/v1/policies/${encodeURIComponent(id)}/activate`, {
      method: 'POST'
    });
  },

  deactivatePolicy: async (id: string): Promise<Policy> => {
    return request<Policy>(API_CONFIG.policy, `/v1/policies/${encodeURIComponent(id)}/deactivate`, {
      method: 'POST'
    });
  },

  createPolicyVersion: async (
    id: string,
    data: { rules: PolicyRule[]; description?: string; activate?: boolean }
  ): Promise<any> => {
    return request<any>(API_CONFIG.policy, `/v1/policies/${encodeURIComponent(id)}/versions`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  listApprovals: async (filter: ListApprovalsFilter = {}): Promise<ApprovalListResponse> => {
    const params = new URLSearchParams();
    if (filter.page) params.set('page', String(filter.page));
    if (filter.limit) params.set('limit', String(filter.limit));
    if (filter.status) params.set('status', filter.status);

    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<ApprovalListResponse>(API_CONFIG.policy, `/v1/approvals${qs}`);
  },

  getApproval: async (id: string): Promise<ApprovalRequest> => {
    return request<ApprovalRequest>(API_CONFIG.policy, `/v1/approvals/${encodeURIComponent(id)}`);
  },

  submitApprovalDecision: async (
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    reason?: string
  ): Promise<ApprovalRequest> => {
    return request<ApprovalRequest>(API_CONFIG.policy, `/v1/approvals/${encodeURIComponent(id)}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, reason: reason || `Decision: ${decision}` })
    });
  }
};
