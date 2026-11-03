import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { AuthLayout } from '@/layouts/AuthLayout';

import { LandingPage } from '@/pages/LandingPage';
import { GetStartedPage } from '@/pages/GetStartedPage';
import { DocsPage } from '@/pages/DocsPage';
import { LoginPage } from '@/pages/LoginPage';
import { OverviewPage } from '@/pages/OverviewPage';
import { PlaygroundPage } from '@/pages/PlaygroundPage';
import { RequestsPage } from '@/pages/RequestsPage';
import { RequestDetailPage } from '@/pages/RequestDetailPage';
import { TracesPage } from '@/pages/TracesPage';
import { PrivacyScannerPage } from '@/pages/PrivacyScannerPage';
import { PoliciesPage } from '@/pages/PoliciesPage';
import { ApprovalCenterPage } from '@/pages/ApprovalCenterPage';
import { ModelsPage } from '@/pages/ModelsPage';
import { SecurityAuditPage } from '@/pages/SecurityAuditPage';
import { DevelopersPage } from '@/pages/DevelopersPage';
import { OrganizationPage } from '@/pages/OrganizationPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

import { RouteErrorElement } from '@/components/common/ErrorBoundary';

export const router = createBrowserRouter([
  // Public Routes
  {
    path: '/',
    element: <LandingPage />,
    errorElement: <RouteErrorElement />,
  },
  {
    path: '/get-started',
    element: <GetStartedPage />,
    errorElement: <RouteErrorElement />,
  },
  {
    path: '/docs',
    element: <DocsPage />,
    errorElement: <RouteErrorElement />,
  },
  {
    path: '/login',
    element: <AuthLayout />,
    errorElement: <RouteErrorElement />,
    children: [
      {
        index: true,
        element: <LoginPage />,
      },
    ],
  },

  // Authenticated Dashboard Routes
  {
    element: <DashboardLayout />,
    errorElement: <RouteErrorElement />,
    children: [
      {
        path: 'dashboard',
        element: <Navigate to="/overview" replace />,
      },
      {
        path: 'overview',
        element: <OverviewPage />,
      },
      {
        path: 'playground',
        element: <PlaygroundPage />,
      },
      {
        path: 'requests',
        element: <RequestsPage />,
      },
      {
        path: 'requests/:id',
        element: <RequestDetailPage />,
      },
      {
        path: 'traces',
        element: <TracesPage />,
      },
      {
        path: 'privacy',
        element: <PrivacyScannerPage />,
      },
      {
        path: 'policies',
        element: <PoliciesPage />,
      },
      {
        path: 'approvals',
        element: <ApprovalCenterPage />,
      },
      {
        path: 'models',
        element: <ModelsPage />,
      },
      {
        path: 'audit',
        element: <SecurityAuditPage />,
      },
      {
        path: 'organization',
        element: <OrganizationPage />,
      },
      {
        path: 'organizations',
        element: <OrganizationPage />,
      },
      {
        path: 'developers',
        element: <DevelopersPage />,
      },
      {
        path: 'users',
        element: <DevelopersPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);
