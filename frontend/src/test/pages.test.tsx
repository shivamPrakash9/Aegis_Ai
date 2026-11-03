import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { AuthProvider } from '../hooks/useAuth';
import { ToastProvider } from '../hooks/useToast';

describe('Application Pages', () => {
  describe('LoginPage', () => {
    it('renders login credentials form and quick test buttons', () => {
      render(
        <MemoryRouter>
          <AuthProvider>
            <ToastProvider>
              <LoginPage />
            </ToastProvider>
          </AuthProvider>
        </MemoryRouter>
      );

      expect(screen.getByText('Enterprise Sign In')).toBeInTheDocument();
      expect(screen.getByLabelText(/corporate email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /authenticate/i })).toBeInTheDocument();

      // Quick test account buttons
      expect(screen.getByRole('button', { name: /admin/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /developer/i })).toBeInTheDocument();
    });
  });

  describe('NotFoundPage', () => {
    it('renders 404 message and navigation link back to overview', () => {
      render(
        <MemoryRouter>
          <NotFoundPage />
        </MemoryRouter>
      );

      expect(screen.getByText('Page Not Found')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /return to overview/i })).toBeInTheDocument();
    });
  });
});
