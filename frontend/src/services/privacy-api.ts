// Privacy Scanner API Services

import { request, API_CONFIG } from './api-client';
import type {
  ChatMessage,
  PrivacyConfig,
  PrivacyScanResponse,
  ScannerLimitations,
  CustomPattern
} from '../types';

export interface ScanPayload {
  organizationId: string;
  messages?: ChatMessage[];
  text?: string;
  mode?: 'MASK' | 'BLOCK' | 'AUDIT' | 'ALLOW';
}

export const privacyApi = {
  scan: async (payload: ScanPayload): Promise<PrivacyScanResponse> => {
    return request<PrivacyScanResponse>(API_CONFIG.privacy, '/v1/scan', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  getLimitations: async (): Promise<ScannerLimitations> => {
    return request<ScannerLimitations>(API_CONFIG.privacy, '/v1/config/limitations', {
      skipAuth: true
    });
  },

  getConfig: async (): Promise<PrivacyConfig> => {
    return request<PrivacyConfig>(API_CONFIG.privacy, '/v1/config');
  },

  updateConfig: async (config: { enabledCategories: string[]; maskingConfiguration?: Record<string, unknown> }): Promise<PrivacyConfig> => {
    return request<PrivacyConfig>(API_CONFIG.privacy, '/v1/config', {
      method: 'PUT',
      body: JSON.stringify(config)
    });
  },

  addCustomPattern: async (pattern: {
    name: string;
    pattern: string;
    severity?: string;
    action?: string;
    replacement?: string;
  }): Promise<CustomPattern> => {
    return request<CustomPattern>(API_CONFIG.privacy, '/v1/config/patterns', {
      method: 'POST',
      body: JSON.stringify(pattern)
    });
  }
};
