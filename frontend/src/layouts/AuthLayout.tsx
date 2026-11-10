import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ThemeToggle } from '../components/layout/ThemeToggle';
import { Shield } from 'lucide-react';

export function AuthLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/overview" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-background text-foreground p-4 sm:p-6 md:p-8">
      <div className="flex items-center justify-between max-w-5xl w-full mx-auto">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">
            <Shield className="h-4 w-4" />
          </div>
          <span className="font-bold text-base tracking-tight">AegisAI</span>
        </div>
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md mx-auto my-auto py-8">
        <Outlet />
      </div>

      <div className="text-center text-xs text-muted-foreground max-w-5xl w-full mx-auto">
        AegisAI — Enterprise AI Security & Governance Gateway &copy; {new Date().getFullYear()}
      </div>
    </div>
  );
}
