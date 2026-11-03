import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LandingPage } from '../pages/LandingPage';
import { GetStartedPage } from '../pages/GetStartedPage';
import { DocsPage } from '../pages/DocsPage';
import { OrganizationPage } from '../pages/OrganizationPage';
import { DevelopersPage } from '../pages/DevelopersPage';
import { AuthContext } from '../hooks/useAuth';
import { ToastProvider } from '../hooks/useToast';
import { ThemeProvider } from '../hooks/useTheme';
import { identityApi } from '../services/identity-api';
import { SafeUser } from '../types';

vi.mock('../services/identity-api', () => ({
  identityApi: {
    getOrganization: vi.fn(),
    updateOrganization: vi.fn(),
    createOrganization: vi.fn(),
    listUsers: vi.fn(),
    getUserStats: vi.fn().mockResolvedValue({ total: 3, developers: 1, auditors: 1, admins: 1 }),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    disableUser: vi.fn(),
    deleteUser: vi.fn(),
  },
}));

describe('Platform Workflows: Landing, Get Started, Organization & Developers', () => {
  let queryClient: QueryClient;

  const mockAdminPrincipal = {
    id: 'user_admin_123',
    organizationId: 'org_enterprise_alpha',
    type: 'USER' as const,
    email: 'admin@enterprise.internal',
    displayName: 'Organization Admin',
    role: 'ORGANIZATION_ADMIN' as const,
    permissions: ['organization:read', 'organization:update', 'users:read', 'users:create', 'users:update', 'users:disable'],
  };

  const mockDeveloperPrincipal = {
    id: 'user_dev_456',
    organizationId: 'org_enterprise_alpha',
    type: 'USER' as const,
    email: 'developer@enterprise.internal',
    displayName: 'Lead Developer',
    role: 'DEVELOPER' as const,
    permissions: ['organization:read', 'users:read'],
  };

  const createMockAuth = (user: any = null, isAdmin = false) => ({
    user,
    isLoading: false,
    isAuthenticated: Boolean(user),
    isAdmin,
    isAuditor: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasPermission: () => true,
  });

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
    vi.clearAllMocks();
  });

  describe('1. Public Landing Page', () => {
    it('renders hero section, headlines, and call-to-actions without requiring authentication', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <ThemeProvider>
              <AuthContext.Provider value={createMockAuth(null, false)}>
                <LandingPage />
              </AuthContext.Provider>
            </ThemeProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText(/Secure Every AI Interaction\./i)).toBeInTheDocument();
      expect(screen.getByText(/Govern Every Decision\./i)).toBeInTheDocument();
      expect(screen.getAllByText(/Get Started/i)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/Sign In/i)[0]).toBeInTheDocument();
      expect(screen.getByText(/Six Independent Microservices, One Unified Gateway/i)).toBeInTheDocument();
    });

    it('interacts with synthetic request pipeline simulation on click', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <ThemeProvider>
              <AuthContext.Provider value={createMockAuth(null, false)}>
                <LandingPage />
              </AuthContext.Provider>
            </ThemeProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Verify initial simulation step content
      expect(screen.getByText(/Please summarize this sample customer record: user@example\.test/i)).toBeInTheDocument();

      // Click Next Stage
      const nextBtn = screen.getByRole('button', { name: /Next Stage/i });
      fireEvent.click(nextBtn);

      // Verify privacy scanner masked stage content
      expect(screen.getByText(/Please summarize this sample customer record: \[EMAIL_1\]/i)).toBeInTheDocument();
    });
  });

  describe('2. Get Started Onboarding Page', () => {
    it('renders organization registration form with auto-slug generation', async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <ThemeProvider>
              <AuthContext.Provider value={createMockAuth(null, false)}>
                <ToastProvider>
                  <GetStartedPage />
                </ToastProvider>
              </AuthContext.Provider>
            </ThemeProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      expect(screen.getByText('Get Started with AegisAI')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Create New Organization/i })).toBeInTheDocument();

      const nameInput = screen.getByPlaceholderText('Acme Technologies');
      fireEvent.change(nameInput, { target: { value: 'CyberSec Labs' } });

      const slugInput = screen.getByPlaceholderText('acme-technologies');
      expect((slugInput as HTMLInputElement).value).toBe('cybersec-labs');
    });

    it('switches to Join Existing Organization tab with instructions', () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <ThemeProvider>
              <AuthContext.Provider value={createMockAuth(null, false)}>
                <ToastProvider>
                  <GetStartedPage />
                </ToastProvider>
              </AuthContext.Provider>
            </ThemeProvider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      const joinTab = screen.getByRole('button', { name: /Join Existing Organization/i });
      fireEvent.click(joinTab);

      expect(screen.getByText(/Contact your Organization Administrator/i)).toBeInTheDocument();
      expect(screen.getByText(/Receive your provisioned credentials/i)).toBeInTheDocument();
    });
  });

  describe('3. Organization Management Page', () => {
    it('renders organization metadata and displays edit modal for admin', async () => {
      vi.mocked(identityApi.getOrganization).mockResolvedValue({
        id: 'org_enterprise_alpha',
        name: 'Enterprise Alpha Corp',
        slug: 'enterprise-alpha',
        status: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00.000Z',
      });

      vi.mocked(identityApi.listUsers).mockResolvedValue({
        users: [
          {
            id: 'u1',
            organizationId: 'org_enterprise_alpha',
            email: 'admin@enterprise.internal',
            displayName: 'Admin User',
            role: 'ORGANIZATION_ADMIN',
            status: 'ACTIVE',
          },
        ],
        total: 1,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <AuthContext.Provider value={createMockAuth(mockAdminPrincipal, true)}>
              <ToastProvider>
                <OrganizationPage />
              </ToastProvider>
            </AuthContext.Provider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Enterprise Alpha Corp')).toBeInTheDocument();
        expect(screen.getByText(/Tenant Slug: enterprise-alpha/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Edit Organization/i })).toBeInTheDocument();
      });

      // Open edit modal
      fireEvent.click(screen.getByRole('button', { name: /Edit Organization/i }));
      expect(screen.getByText('Edit Organization Details')).toBeInTheDocument();
    });

    it('hides edit organization button from developer', async () => {
      vi.mocked(identityApi.getOrganization).mockResolvedValue({
        id: 'org_enterprise_alpha',
        name: 'Enterprise Alpha Corp',
        slug: 'enterprise-alpha',
        status: 'ACTIVE',
      });

      vi.mocked(identityApi.listUsers).mockResolvedValue({ users: [], total: 0 });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <AuthContext.Provider value={createMockAuth(mockDeveloperPrincipal, false)}>
              <ToastProvider>
                <OrganizationPage />
              </ToastProvider>
            </AuthContext.Provider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Enterprise Alpha Corp')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /Edit Organization/i })).not.toBeInTheDocument();
    });
  });

  describe('4. Developers and Team Members Page', () => {
    const mockUsers: SafeUser[] = [
      {
        id: 'user_admin_123',
        organizationId: 'org_enterprise_alpha',
        email: 'admin@enterprise.internal',
        displayName: 'Organization Admin',
        role: 'ORGANIZATION_ADMIN',
        status: 'ACTIVE',
        lastLoginAt: '2026-10-21T00:00:00.000Z',
      },
      {
        id: 'user_dev_456',
        organizationId: 'org_enterprise_alpha',
        email: 'developer@enterprise.internal',
        displayName: 'Lead Developer',
        role: 'DEVELOPER',
        status: 'ACTIVE',
      },
      {
        id: 'user_audit_789',
        organizationId: 'org_enterprise_alpha',
        email: 'auditor@enterprise.internal',
        displayName: 'Security Auditor',
        role: 'SECURITY_AUDITOR',
        status: 'ACTIVE',
      },
    ];

    it('lists developers and displays onboarding button for organization admin', async () => {
      vi.mocked(identityApi.listUsers).mockResolvedValue({
        users: mockUsers,
        total: 3,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <AuthContext.Provider value={createMockAuth(mockAdminPrincipal, true)}>
              <ToastProvider>
                <DevelopersPage />
              </ToastProvider>
            </AuthContext.Provider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Lead Developer')).toBeInTheDocument();
        expect(screen.getByText('Security Auditor')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Onboard Developer/i })).toBeInTheDocument();
      });
    });

    it('filters members by role dropdown', async () => {
      vi.mocked(identityApi.listUsers).mockResolvedValue({
        users: mockUsers,
        total: 3,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <AuthContext.Provider value={createMockAuth(mockAdminPrincipal, true)}>
              <ToastProvider>
                <DevelopersPage />
              </ToastProvider>
            </AuthContext.Provider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Lead Developer')).toBeInTheDocument();
      });

      // Filter by DEVELOPER
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'DEVELOPER' } });

      expect(screen.getByText('Lead Developer')).toBeInTheDocument();
      expect(screen.queryByText('Security Auditor')).not.toBeInTheDocument();
    });

    it('prevents developers from viewing onboarding and revocation controls', async () => {
      vi.mocked(identityApi.listUsers).mockResolvedValue({
        users: mockUsers,
        total: 3,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <AuthContext.Provider value={createMockAuth(mockDeveloperPrincipal, false)}>
              <ToastProvider>
                <DevelopersPage />
              </ToastProvider>
            </AuthContext.Provider>
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Lead Developer')).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /Onboard Developer/i })).not.toBeInTheDocument();
      expect(screen.queryByTitle('Remove Member')).not.toBeInTheDocument();
    });
  });

  describe('5. Platform Documentation Page', () => {
    it('renders microservices topology and copyable curl quickstart', () => {
      render(
        <MemoryRouter>
          <ThemeProvider>
            <DocsPage />
          </ThemeProvider>
        </MemoryRouter>
      );

      expect(screen.getByText('AegisAI Architecture & Integration Guide')).toBeInTheDocument();
      expect(screen.getByText('Identity Service')).toBeInTheDocument();
      expect(screen.getByText('AI Gateway')).toBeInTheDocument();
      expect(screen.getByText('Privacy Scanner')).toBeInTheDocument();
      expect(screen.getByText('Policy Approval')).toBeInTheDocument();
      expect(screen.getByText('Model Provider')).toBeInTheDocument();
      expect(screen.getByText('Security Audit')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Copy cURL/i })).toBeInTheDocument();
    });
  });
});
