// Model & Provider Service API Client

import { request, API_CONFIG } from './api-client';
import type { ModelConfig, ProviderConfig, ProviderTestResult, UsageRecord } from '../types';

export interface ModelListResponse {
  object: string;
  data: ModelConfig[];
}

export interface ProviderListResponse {
  object: string;
  data: ProviderConfig[];
}

export interface UsageResponse {
  items: UsageRecord[];
  total: number;
}

export const modelApi = {
  // --- Models API ---

  listModels: async (enabledOnly = false): Promise<ModelConfig[]> => {
    const qs = enabledOnly ? '?enabled=true' : '';
    const res = await request<ModelListResponse>(API_CONFIG.model, `/v1/models${qs}`, {
      skipAuth: true
    });
    return res.data || [];
  },

  getModel: async (id: string): Promise<ModelConfig> => {
    return request<ModelConfig>(API_CONFIG.model, `/v1/models/${encodeURIComponent(id)}`, {
      skipAuth: true
    });
  },

  enableModel: async (id: string): Promise<ModelConfig> => {
    return request<ModelConfig>(API_CONFIG.model, `/v1/models/${encodeURIComponent(id)}/enable`, {
      method: 'POST'
    });
  },

  disableModel: async (id: string): Promise<ModelConfig> => {
    return request<ModelConfig>(API_CONFIG.model, `/v1/models/${encodeURIComponent(id)}/disable`, {
      method: 'POST'
    });
  },

  registerModel: async (model: {
    modelId: string;
    provider: string;
    providerModelName?: string;
    contextWindow?: number;
    maxTokens?: number;
    capabilities?: string[];
    description?: string;
    enabled?: boolean;
    isDefault?: boolean;
  }): Promise<ModelConfig> => {
    return request<ModelConfig>(API_CONFIG.model, '/v1/models', {
      method: 'POST',
      body: JSON.stringify(model)
    });
  },

  updateModel: async (
    id: string,
    model: {
      provider?: string;
      providerModelName?: string;
      contextWindow?: number;
      maxTokens?: number;
      capabilities?: string[];
      description?: string;
      enabled?: boolean;
      isDefault?: boolean;
    }
  ): Promise<ModelConfig> => {
    return request<ModelConfig>(API_CONFIG.model, `/v1/models/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(model)
    });
  },

  deleteModel: async (id: string): Promise<{ success: boolean; modelId: string }> => {
    return request<{ success: boolean; modelId: string }>(
      API_CONFIG.model,
      `/v1/models/${encodeURIComponent(id)}`,
      {
        method: 'DELETE'
      }
    );
  },

  // --- Providers API ---

  listProviders: async (enabledOnly = false): Promise<ProviderConfig[]> => {
    const qs = enabledOnly ? '?enabled=true' : '';
    const res = await request<ProviderListResponse>(API_CONFIG.model, `/v1/providers${qs}`, {
      skipAuth: true
    });
    return res.data || [];
  },

  getProvider: async (id: string): Promise<ProviderConfig> => {
    return request<ProviderConfig>(API_CONFIG.model, `/v1/providers/${encodeURIComponent(id)}`, {
      skipAuth: true
    });
  },

  registerProvider: async (provider: {
    id: string;
    name: string;
    type: 'openai' | 'anthropic' | 'gemini' | 'mock' | 'custom';
    baseUrl?: string;
    apiKey?: string;
    description?: string;
    organizationId?: string;
    enabled?: boolean;
  }): Promise<ProviderConfig> => {
    return request<ProviderConfig>(API_CONFIG.model, '/v1/providers', {
      method: 'POST',
      body: JSON.stringify(provider)
    });
  },

  updateProvider: async (
    id: string,
    provider: {
      name?: string;
      type?: 'openai' | 'anthropic' | 'gemini' | 'mock' | 'custom';
      baseUrl?: string;
      apiKey?: string;
      description?: string;
      organizationId?: string;
      enabled?: boolean;
    }
  ): Promise<ProviderConfig> => {
    return request<ProviderConfig>(API_CONFIG.model, `/v1/providers/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(provider)
    });
  },

  deleteProvider: async (id: string): Promise<{ success: boolean; id: string }> => {
    return request<{ success: boolean; id: string }>(
      API_CONFIG.model,
      `/v1/providers/${encodeURIComponent(id)}`,
      {
        method: 'DELETE'
      }
    );
  },

  enableProvider: async (id: string): Promise<ProviderConfig> => {
    return request<ProviderConfig>(API_CONFIG.model, `/v1/providers/${encodeURIComponent(id)}/enable`, {
      method: 'POST'
    });
  },

  disableProvider: async (id: string): Promise<ProviderConfig> => {
    return request<ProviderConfig>(API_CONFIG.model, `/v1/providers/${encodeURIComponent(id)}/disable`, {
      method: 'POST'
    });
  },

  testProvider: async (id: string): Promise<ProviderTestResult> => {
    return request<ProviderTestResult>(API_CONFIG.model, `/v1/providers/${encodeURIComponent(id)}/test`, {
      method: 'POST'
    });
  },

  // --- Telemetry API ---

  getUsage: async (options: { limit?: number; offset?: number; model?: string; provider?: string } = {}): Promise<UsageResponse> => {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.offset !== undefined) params.set('offset', String(options.offset));
    if (options.model) params.set('model', options.model);
    if (options.provider) params.set('provider', options.provider);

    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<UsageResponse>(API_CONFIG.model, `/v1/usage${qs}`);
  }
};
