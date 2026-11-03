// AI Gateway API Services

import { request, API_CONFIG } from './api-client';
import type {
  AiRequestSubmissionResponse,
  AiRequestDetail,
  AiRequestListItem,
  PaginatedResponse,
  SubmitAiRequestPayload,
  AuditTrace,
  EnrichedAiRequestTrace
} from '../types';

export interface ListRequestsFilter {
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  cursor?: string;
  search?: string;
  model?: string;
}

export const gatewayApi = {
  submitRequest: async (
    payload: SubmitAiRequestPayload,
    idempotencyKey?: string
  ): Promise<AiRequestSubmissionResponse> => {
    const key = idempotencyKey || `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return request<AiRequestSubmissionResponse>(API_CONFIG.gateway, '/v1/ai-requests', {
      method: 'POST',
      headers: {
        'Idempotency-Key': key
      },
      body: JSON.stringify(payload)
    });
  },

  getRequestById: async (id: string): Promise<AiRequestDetail> => {
    return request<AiRequestDetail>(API_CONFIG.gateway, `/v1/ai-requests/${encodeURIComponent(id)}`);
  },

  listRequests: async (filter: ListRequestsFilter = {}): Promise<PaginatedResponse<AiRequestListItem>> => {
    const params = new URLSearchParams();
    if (filter.status) params.set('status', filter.status);
    if (filter.startDate) params.set('startDate', filter.startDate);
    if (filter.endDate) params.set('endDate', filter.endDate);
    if (filter.page) params.set('page', String(filter.page));
    if (filter.limit) params.set('limit', String(filter.limit));
    if (filter.cursor) params.set('cursor', filter.cursor);
    if (filter.search) params.set('search', filter.search);
    if (filter.model) params.set('model', filter.model);

    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<PaginatedResponse<AiRequestListItem>>(API_CONFIG.gateway, `/v1/ai-requests${qs}`);
  },

  getRequestTrace: async (id: string): Promise<EnrichedAiRequestTrace> => {
    return request<EnrichedAiRequestTrace>(API_CONFIG.gateway, `/v1/ai-requests/${encodeURIComponent(id)}/trace`);
  },

  resumeRequest: async (id: string): Promise<AiRequestSubmissionResponse> => {
    return request<AiRequestSubmissionResponse>(API_CONFIG.gateway, `/v1/ai-requests/${encodeURIComponent(id)}/resume`, {
      method: 'POST'
    });
  }
};
