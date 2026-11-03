import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi } from '../services/auth-api';
import { tokenStore } from '../services/api-client';
import type { AuthenticatedPrincipal } from '../types';

interface AuthContextType {
  user: AuthenticatedPrincipal | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  isAdmin: boolean;
  isAuditor: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthenticatedPrincipal | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const token = tokenStore.getAccessToken();
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      const principal = await authApi.getCurrentUser();
      setUser(principal);
    } catch {
      setUser(null);
      tokenStore.clearTokens();
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();

    const handleAuthExpired = () => {
      setUser(null);
    };

    window.addEventListener('aegis:auth_expired', handleAuthExpired);
    return () => {
      window.removeEventListener('aegis:auth_expired', handleAuthExpired);
    };
  }, [fetchCurrentUser]);

  const login = async (credentials: { email: string; password: string }) => {
    setIsLoading(true);
    try {
      await authApi.login(credentials);
      const principal = await authApi.getCurrentUser();
      setUser(principal);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  };

  const hasPermission = useCallback((permission: string): boolean => {
    if (!user) return false;
    if (user.role === 'ORGANIZATION_ADMIN' || user.role === 'ADMIN') return true;
    return user.permissions?.includes(permission) || false;
  }, [user]);

  const isAdmin = user?.role === 'ORGANIZATION_ADMIN' || user?.role === 'ADMIN';
  const isAuditor = user?.role === 'SECURITY_AUDITOR' || isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        hasPermission,
        isAdmin,
        isAuditor
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
