import { describe, it, expect, beforeEach, vi } from 'vitest';
import { tokenStore } from '../services/api-client';

describe('TokenStore & Authentication Isolation', () => {
  beforeEach(() => {
    tokenStore.clearTokens();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('stores and retrieves access and refresh tokens from sessionStorage', () => {
    expect(tokenStore.getAccessToken()).toBeNull();
    expect(tokenStore.getRefreshToken()).toBeNull();

    tokenStore.setTokens('mock-access-token-123', 'mock-refresh-token-456');

    expect(tokenStore.getAccessToken()).toBe('mock-access-token-123');
    expect(tokenStore.getRefreshToken()).toBe('mock-refresh-token-456');
    expect(sessionStorage.getItem('aegis_access_token')).toBe('mock-access-token-123');
    // Ensure tokens are NOT saved to localStorage
    expect(localStorage.getItem('aegis_access_token')).toBeNull();
  });

  it('clears tokens accurately on logout or session expiration', () => {
    tokenStore.setTokens('token-to-clear', 'refresh-to-clear');
    expect(tokenStore.getAccessToken()).toBe('token-to-clear');

    tokenStore.clearTokens();
    expect(tokenStore.getAccessToken()).toBeNull();
    expect(tokenStore.getRefreshToken()).toBeNull();
    expect(sessionStorage.getItem('aegis_access_token')).toBeNull();
  });
});
