// Centralized Typed HTTP API Client with Interceptors, Token Management & Error Normalization

export class ApiError extends Error {
  public status: number;
  public code?: string;
  public details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// In-memory token storage (secure, isolated from browser persistent storage)
let currentAccessToken: string | null = null;
let currentRefreshToken: string | null = null;
let tokenRefreshPromise: Promise<string | null> | null = null;

// Base URL configuration (prefer Vite proxy paths for dev, or env variables in prod)
export const API_CONFIG = {
  identity: import.meta.env.VITE_IDENTITY_API_URL || '/api/identity',
  gateway: import.meta.env.VITE_GATEWAY_API_URL || '/api/gateway',
  privacy: import.meta.env.VITE_PRIVACY_API_URL || '/api/privacy',
  policy: import.meta.env.VITE_POLICY_API_URL || '/api/policy',
  model: import.meta.env.VITE_MODEL_API_URL || '/api/model',
  audit: import.meta.env.VITE_AUDIT_API_URL || '/api/audit'
};

export const tokenStore = {
  getAccessToken: () => currentAccessToken || sessionStorage.getItem('aegis_access_token'),
  getRefreshToken: () => currentRefreshToken || sessionStorage.getItem('aegis_refresh_token'),
  setTokens: (accessToken: string, refreshToken: string) => {
    currentAccessToken = accessToken;
    currentRefreshToken = refreshToken;
    try {
      sessionStorage.setItem('aegis_access_token', accessToken);
      sessionStorage.setItem('aegis_refresh_token', refreshToken);
    } catch {
      // Storage unavailable or blocked
    }
  },
  clearTokens: () => {
    currentAccessToken = null;
    currentRefreshToken = null;
    try {
      sessionStorage.removeItem('aegis_access_token');
      sessionStorage.removeItem('aegis_refresh_token');
    } catch {
      // Storage unavailable
    }
  }
};

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  skipAuth?: boolean;
}

export async function request<T>(
  baseUrl: string,
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { timeoutMs = 25000, skipAuth = false, headers = {}, ...rest } = options;

  const url = `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
  const reqHeaders = new Headers(headers);

  // Set standard headers
  if (!reqHeaders.has('Content-Type') && !(rest.body instanceof FormData)) {
    reqHeaders.set('Content-Type', 'application/json');
  }

  // Correlation ID tracking
  if (!reqHeaders.has('X-Correlation-Id')) {
    reqHeaders.set('X-Correlation-Id', `fe_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
  }

  // Attach Bearer Access Token
  if (!skipAuth) {
    const token = tokenStore.getAccessToken();
    if (token && !reqHeaders.has('Authorization')) {
      reqHeaders.set('Authorization', `Bearer ${token}`);
    }
  }

  // AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...rest,
      headers: reqHeaders,
      signal: rest.signal || controller.signal
    });

    clearTimeout(timeoutId);

    // Handle 401 Unauthorized with automatic refresh token rotation
    if (response.status === 401 && !skipAuth && !endpoint.includes('/auth/refresh') && !endpoint.includes('/auth/login')) {
      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) {
        reqHeaders.set('Authorization', `Bearer ${refreshedToken}`);
        const retryRes = await fetch(url, {
          ...rest,
          headers: reqHeaders
        });
        return handleResponse<T>(retryRes);
      } else {
        tokenStore.clearTokens();
        window.dispatchEvent(new CustomEvent('aegis:auth_expired'));
        throw new ApiError(401, 'Session expired. Please log in again.', 'UNAUTHORIZED');
      }
    }

    return handleResponse<T>(response);
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new ApiError(408, `Request timed out after ${timeoutMs}ms`, 'TIMEOUT');
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, error.message || 'Network connection failed', 'NETWORK_ERROR');
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return {} as T;
  }

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    let message = response.statusText || 'An error occurred';
    if (isJson && data) {
      if (typeof data.message === 'string') {
        message = data.message;
      } else if (typeof data.error === 'string') {
        message = data.error;
      } else if (typeof data.error?.message === 'string') {
        message = data.error.message;
      }
    } else if (typeof data === 'string' && data.length > 0) {
      message = data;
    }
    const code = (isJson && (data?.code || data?.error?.code)) || String(response.status);
    throw new ApiError(response.status, message, code, isJson ? data : undefined);
  }

  return data as T;
}

// Token refresh mutex to avoid parallel refresh requests
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStore.getRefreshToken();
  if (!refreshToken) return null;

  if (tokenRefreshPromise) {
    return tokenRefreshPromise;
  }

  tokenRefreshPromise = (async () => {
    try {
      const res = await fetch(`${API_CONFIG.identity}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (!res.ok) {
        tokenStore.clearTokens();
        return null;
      }

      const json = await res.json();
      if (json?.tokens?.accessToken) {
        tokenStore.setTokens(json.tokens.accessToken, json.tokens.refreshToken || refreshToken);
        return json.tokens.accessToken;
      }
      return null;
    } catch {
      return null;
    } finally {
      tokenRefreshPromise = null;
    }
  })();

  return tokenRefreshPromise;
}
