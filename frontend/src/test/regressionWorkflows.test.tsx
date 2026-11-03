import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PlaygroundPage } from '../pages/PlaygroundPage';
import { RequestDetailPage } from '../pages/RequestDetailPage';
import { ModelsPage } from '../pages/ModelsPage';
import { AuthContext } from '../hooks/useAuth';
import { ToastProvider } from '../hooks/useToast';
import { gatewayApi } from '../services/gateway-api';
import { modelApi } from '../services/model-api';
import { privacyApi } from '../services/privacy-api';

vi.mock('../services/gateway-api');
vi.mock('../services/model-api');
vi.mock('../services/privacy-api');

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

const mockAdminUser = {
  id: 'usr_admin',
  organizationId: 'org_alpha',
  email: 'admin@enterprise.internal',
  displayName: 'Admin User',
  role: 'ORGANIZATION_ADMIN' as const,
  status: 'ACTIVE' as const,
  permissions: ['*'],
  type: 'USER' as const,
};

const mockDevUser = {
  id: 'usr_dev',
  organizationId: 'org_alpha',
  email: 'dev@enterprise.internal',
  displayName: 'Dev User',
  role: 'DEVELOPER' as const,
  status: 'ACTIVE' as const,
  permissions: ['ai:invoke'],
  type: 'USER' as const,
};

describe('Regression Workflows: AI Response & Model/Provider Management', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    queryClient = createTestQueryClient();

    // Default model list mock
    vi.mocked(modelApi.listModels).mockResolvedValue([
      {
        modelId: 'mock-gpt-4o',
        provider: 'mock',
        providerModelName: 'mock-gpt-4o',
        enabled: true,
        isDefault: true,
        maxTokens: 4096,
        contextWindow: 128000,
        capabilities: ['chat'],
      },
    ]);

    // Default provider list mock
    vi.mocked(modelApi.listProviders).mockResolvedValue([
      {
        id: 'mock',
        name: 'Mock Provider',
        type: 'mock',
        baseUrl: null,
        apiKeyConfigured: true,
        apiKeyMasked: '****',
        enabled: true,
        isHealthy: true,
      },
    ]);

    vi.mocked(modelApi.getUsage).mockResolvedValue({ items: [], total: 0 });
  });

  it('1. Completed AI Gateway request displays its actual sanitized response text in Playground', async () => {
    vi.mocked(gatewayApi.submitRequest).mockResolvedValue({
      requestId: 'req_test_123',
      status: 'ACCEPTED',
      traceId: 'trace_test_123',
    });

    vi.mocked(gatewayApi.getRequestById).mockResolvedValue({
      id: 'req_test_123',
      status: 'COMPLETED',
      modelSelected: 'mock-gpt-4o',
      sanitizedResult: 'France capital is Paris. This is verified by AegisAI.',
      traceId: 'trace_test_123',
      privacyAction: 'ALLOW',
      policyDecision: 'ALLOW',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AuthContext.Provider
            value={{
              user: mockAdminUser,
              isAuthenticated: true,
              isLoading: false,
              isAdmin: true,
              isAuditor: false,
              login: vi.fn(),
              logout: vi.fn(),
              hasPermission: () => true,
            }}
          >
            <ToastProvider>
              <PlaygroundPage />
            </ToastProvider>
          </AuthContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const textarea = screen.getByPlaceholderText(/Ask a question, generate code/i);
    fireEvent.change(textarea, { target: { value: 'What is the capital of France?' } });

    const submitBtn = screen.getByRole('button', { name: /Execute Request/i });
    const form = submitBtn.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/France capital is Paris\. This is verified by AegisAI\./i)).toBeInTheDocument();
    });

    expect(gatewayApi.submitRequest).toHaveBeenCalled();
    expect(gatewayApi.getRequestById).toHaveBeenCalledWith('req_test_123');
  });

  it('2. RequestDetailPage fetches from correct endpoint and displays response and mock provider badge', async () => {
    vi.mocked(gatewayApi.getRequestById).mockResolvedValue({
      id: 'req_abc_999',
      status: 'COMPLETED',
      modelSelected: 'mock-gpt-4o',
      sanitizedResult: '[Mock Assistant Response] Echo response from mock LLM adapter.',
      traceId: 'trace_abc_999',
      privacyAction: 'ALLOW',
      policyDecision: 'ALLOW',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/requests/req_abc_999']}>
          <AuthContext.Provider
            value={{
              user: mockAdminUser,
              isAuthenticated: true,
              isLoading: false,
              isAdmin: true,
              isAuditor: false,
              login: vi.fn(),
              logout: vi.fn(),
              hasPermission: () => true,
            }}
          >
            <ToastProvider>
              <Routes>
                <Route path="/requests/:id" element={<RequestDetailPage />} />
              </Routes>
            </ToastProvider>
          </AuthContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Sanitized Model Output/i)).toBeInTheDocument();
      expect(screen.getByText(/\[Mock Assistant Response\] Echo response from mock LLM adapter\./i)).toBeInTheDocument();
      expect(screen.getByText('MOCK')).toBeInTheDocument();
    });
  });

  it('3. Failed request does not fabricate success and displays error details', async () => {
    vi.mocked(gatewayApi.getRequestById).mockResolvedValue({
      id: 'req_fail_111',
      status: 'FAILED',
      errorCode: 'MODEL_INVOCATION_FAILED',
      errorMessage: 'Provider timed out after 30000ms',
      traceId: 'trace_fail_111',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/requests/req_fail_111']}>
          <AuthContext.Provider
            value={{
              user: mockAdminUser,
              isAuthenticated: true,
              isLoading: false,
              isAdmin: true,
              isAuditor: false,
              login: vi.fn(),
              logout: vi.fn(),
              hasPermission: () => true,
            }}
          >
            <ToastProvider>
              <Routes>
                <Route path="/requests/:id" element={<RequestDetailPage />} />
              </Routes>
            </ToastProvider>
          </AuthContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Execution Error \(MODEL_INVOCATION_FAILED\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Provider timed out after 30000ms/i)).toBeInTheDocument();
      expect(screen.queryByText(/France capital is Paris/i)).not.toBeInTheDocument();
    });
  });

  it('4. Response remains visible after page reload via session restoration in Playground', async () => {
    const cachedRequest = {
      id: 'req_restored_555',
      status: 'COMPLETED' as const,
      modelSelected: 'mock-gpt-4o',
      sanitizedResult: 'Restored persisted assistant message from prior session.',
      traceId: 'trace_restored_555',
      privacyAction: 'ALLOW' as const,
      policyDecision: 'ALLOW' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    sessionStorage.setItem('aegis_playground_last_request', JSON.stringify(cachedRequest));

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AuthContext.Provider
            value={{
              user: mockAdminUser,
              isAuthenticated: true,
              isLoading: false,
              isAdmin: true,
              isAuditor: false,
              login: vi.fn(),
              logout: vi.fn(),
              hasPermission: () => true,
            }}
          >
            <ToastProvider>
              <PlaygroundPage />
            </ToastProvider>
          </AuthContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('Restored persisted assistant message from prior session.')).toBeInTheDocument();
    expect(screen.getByText(/req_restored/i)).toBeInTheDocument();
  });

  it('5. Organization Administrator sees Register Model and Add Provider buttons', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AuthContext.Provider
            value={{
              user: mockAdminUser,
              isAuthenticated: true,
              isLoading: false,
              isAdmin: true,
              isAuditor: false,
              login: vi.fn(),
              logout: vi.fn(),
              hasPermission: () => true,
            }}
          >
            <ToastProvider>
              <ModelsPage />
            </ToastProvider>
          </AuthContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByRole('button', { name: /Add Provider/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Register Model/i })).toBeInTheDocument();
  });

  it('6. Developer cannot see administrative provider and model registration controls', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AuthContext.Provider
            value={{
              user: mockDevUser,
              isAuthenticated: true,
              isLoading: false,
              isAdmin: false,
              isAuditor: false,
              login: vi.fn(),
              logout: vi.fn(),
              hasPermission: () => false,
            }}
          >
            <ToastProvider>
              <ModelsPage />
            </ToastProvider>
          </AuthContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.queryByRole('button', { name: /Add Provider/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Register Model/i })).not.toBeInTheDocument();
  });

  it('7. Opening Add Provider dialog allows configuring endpoint and provider registration', async () => {
    vi.mocked(modelApi.registerProvider).mockResolvedValue({
      id: 'cluster-vllm',
      name: 'vLLM Local Cluster',
      type: 'openai',
      baseUrl: 'http://127.0.0.1:8000/v1',
      apiKeyConfigured: true,
      enabled: true,
      isHealthy: true,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AuthContext.Provider
            value={{
              user: mockAdminUser,
              isAuthenticated: true,
              isLoading: false,
              isAdmin: true,
              isAuditor: false,
              login: vi.fn(),
              logout: vi.fn(),
              hasPermission: () => true,
            }}
          >
            <ToastProvider>
              <ModelsPage />
            </ToastProvider>
          </AuthContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const addProvBtn = screen.getByRole('button', { name: /Add Provider/i });
    fireEvent.click(addProvBtn);

    expect(screen.getByText('Configure AI Provider Adapter')).toBeInTheDocument();

    const idInput = screen.getByPlaceholderText(/e\.g\., local-ollama/i);
    const nameInput = screen.getByPlaceholderText(/e\.g\., Production Ollama Cluster/i);

    fireEvent.change(idInput, { target: { value: 'cluster-vllm' } });
    fireEvent.change(nameInput, { target: { value: 'vLLM Local Cluster' } });

    const saveBtn = screen.getByRole('button', { name: /Save Provider/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(modelApi.registerProvider).toHaveBeenCalledWith({
        id: 'cluster-vllm',
        name: 'vLLM Local Cluster',
        type: 'openai',
        baseUrl: undefined,
        apiKey: undefined,
        enabled: true,
      });
    });
  });
});
