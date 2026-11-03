// Security & Audit Service API Client

import { request, API_CONFIG } from './api-client';
import type {
  AuditEvent,
  AuditTrace,
  DigestVerificationResult
} from '../types';

export interface SearchEventsFilter {
  eventType?: string;
  severity?: string;
  outcome?: string;
  sourceService?: string;
  requestId?: string;
  traceId?: string;
  startTime?: string;
  endTime?: string;
  page?: number;
  limit?: number;
}

export interface SearchEventsResponse {
  events: AuditEvent[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const auditApi = {
  searchEvents: async (filter: SearchEventsFilter = {}): Promise<SearchEventsResponse> => {
    const params = new URLSearchParams();
    if (filter.eventType) params.set('eventType', filter.eventType);
    if (filter.severity) params.set('severity', filter.severity);
    if (filter.outcome) params.set('outcome', filter.outcome);
    if (filter.sourceService) params.set('sourceService', filter.sourceService);
    if (filter.requestId) params.set('requestId', filter.requestId);
    if (filter.traceId) params.set('traceId', filter.traceId);
    if (filter.startTime) params.set('startTime', filter.startTime);
    if (filter.endTime) params.set('endTime', filter.endTime);
    if (filter.page) params.set('page', String(filter.page));
    if (filter.limit) params.set('limit', String(filter.limit));

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await request<any>(API_CONFIG.audit, `/v1/events${qs}`);
    return {
      events: res.data || res.events || [],
      pagination: res.pagination || {
        page: filter.page || 1,
        limit: filter.limit || 20,
        total: (res.data || res.events || []).length,
        totalPages: 1
      }
    };
  },

  getEventById: async (eventId: string): Promise<AuditEvent> => {
    return request<AuditEvent>(API_CONFIG.audit, `/v1/events/${encodeURIComponent(eventId)}`);
  },

  verifyEventDigest: async (eventId: string): Promise<DigestVerificationResult> => {
    const res = await request<any>(API_CONFIG.audit, `/v1/events/${encodeURIComponent(eventId)}/verify`);
    return {
      valid: res.valid ?? res.verified ?? false,
      eventId: res.eventId || eventId,
      digest: res.digest || res.storedDigest || '',
      algorithm: res.algorithm || 'sha256',
      recalculatedDigest: res.digest || res.recalculatedDigest,
    };
  },

  getTrace: async (traceId: string): Promise<AuditTrace> => {
    return request<AuditTrace>(API_CONFIG.audit, `/v1/traces/${encodeURIComponent(traceId)}`);
  },

  getRequestEvents: async (requestId: string): Promise<AuditTrace> => {
    return request<AuditTrace>(API_CONFIG.audit, `/v1/requests/${encodeURIComponent(requestId)}/events`);
  }
};
