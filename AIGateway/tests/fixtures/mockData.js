// Mock Data and Service Response Fixtures for Gateway Tests

const mockUserPrincipal = {
  id: 'user_test_123',
  organizationId: 'org_test_123',
  type: 'USER',
  email: 'dev@aegis.ai',
  displayName: 'Aegis Developer',
  role: 'DEVELOPER',
  permissions: ['ai_requests:create', 'ai_requests:read']
};

const mockTenantBPrincipal = {
  id: 'user_tenant_b',
  organizationId: 'org_tenant_b',
  type: 'USER',
  email: 'other@tenantb.com',
  displayName: 'Tenant B User',
  role: 'DEVELOPER',
  permissions: ['ai_requests:create', 'ai_requests:read']
};

const mockServiceAccountPrincipal = {
  id: 'sa_test_456',
  organizationId: 'org_test_123',
  type: 'SERVICE_ACCOUNT',
  displayName: 'CI Pipeline Agent',
  permissions: ['ai_requests:create', 'ai_requests:read']
};

const mockValidAiPayload = {
  messages: [
    { role: 'user', content: 'Explain zero trust architecture.' }
  ],
  modelPreference: {
    capability: 'general'
  },
  metadata: {
    source: 'integration-test'
  }
};

module.exports = {
  mockUserPrincipal,
  mockTenantBPrincipal,
  mockServiceAccountPrincipal,
  mockValidAiPayload
};
