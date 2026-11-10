// Authentication API Services interacting with Identity Microservice

import { request, API_CONFIG, tokenStore } from './api-client';
import type { AuthenticatedPrincipal, SafeUser, TokenPair } from '../types';

export interface LoginResponse {
  user: SafeUser;
  tokens: TokenPair;
}

export interface RegisterRequest {
  displayName: string;
  email: string;
  password: string;
  organizationName?: string;
  organizationId?: string;
}

export const authApi = {
  login: async (credentials: { email: string; password: string }): Promise<LoginResponse> => {
    const res = await request<LoginResponse>(API_CONFIG.identity, '/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
      skipAuth: true
    });

    if (res.tokens?.accessToken) {
      tokenStore.setTokens(res.tokens.accessToken, res.tokens.refreshToken);
    }
    return res;
  },

  register: async (data: RegisterRequest): Promise<LoginResponse> => {
    const res = await request<LoginResponse>(API_CONFIG.identity, '/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
      skipAuth: true
    });

    if (res.tokens?.accessToken) {
      tokenStore.setTokens(res.tokens.accessToken, res.tokens.refreshToken);
    }
    return res;
  },

  logout: async (): Promise<void> => {
    const refreshToken = tokenStore.getRefreshToken();
    try {
      if (refreshToken) {
        await request(API_CONFIG.identity, '/v1/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
          skipAuth: true
        });
      }
    } finally {
      tokenStore.clearTokens();
    }
  },

  getCurrentUser: async (): Promise<AuthenticatedPrincipal> => {
    return request<AuthenticatedPrincipal>(API_CONFIG.identity, '/v1/auth/me');
  }
};
