// AegisAI Centralized Domain Types for all 6 Microservices

// -------------------------------------------------------------------------
// 1. Identity & Auth Types
// -------------------------------------------------------------------------
export type UserRole = 'ORGANIZATION_ADMIN' | 'DEVELOPER' | 'SECURITY_AUDITOR' | 'ADMIN' | 'USER';

export interface SafeUser {
  id: string;
  organizationId: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface AuthenticatedPrincipal {
  id: string;
  organizationId: string;
  type: 'USER' | 'SERVICE_ACCOUNT';
  email: string;
  displayName: string;
  role: UserRole;
  permissions: string[];
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  createdAt?: string;
  updatedAt?: string;
}

// -------------------------------------------------------------------------
// 2. AI Gateway Types
// -------------------------------------------------------------------------
export type AiRequestStatus = 
  | 'ACCEPTED' 
  | 'PROCESSING' 
  | 'WAITING_FOR_APPROVAL' 
  | 'COMPLETED' 
  | 'BLOCKED' 
  | 'FAILED';

export type PrivacyAction = 'ALLOW' | 'MASK' | 'BLOCK' | 'REQUIRE_APPROVAL' | 'ROUTE';
export type PolicyDecision = 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface SubmitAiRequestPayload {
  messages: ChatMessage[];
  modelPreference?: {
    model?: string;
    provider?: string;
    capability?: 'general' | 'code' | 'analysis' | 'creative' | 'embedding';
  };
  metadata?: Record<string, unknown>;
}

export interface AiRequestSubmissionResponse {
  requestId: string;
  status: AiRequestStatus;
  traceId: string;
  modelSelected?: string | null;
  privacyAction?: PrivacyAction | null;
  policyDecision?: PolicyDecision | null;
  result?: string | null;
  response?: string | null;
  assistantAnswer?: string | null;
  sanitizedResult?: string | null;
  sanitizedPromptSummary?: string | null;
}

export interface AiRequestDetail {
  id: string;
  status: AiRequestStatus;
  modelSelected?: string | null;
  sanitizedResult?: string | null;
  result?: string | null;
  response?: string | null;
  assistantAnswer?: string | null;
  sanitizedPromptSummary?: string | null;
  traceId: string;
  privacyAction?: PrivacyAction | null;
  policyDecision?: PolicyDecision | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface AiRequestListItem {
  id: string;
  status: AiRequestStatus;
  modelSelected?: string | null;
  sanitizedResult?: string | null;
  result?: string | null;
  response?: string | null;
  assistantAnswer?: string | null;
  sanitizedPromptSummary?: string | null;
  traceId: string;
  createdAt: string;
  completedAt?: string | null;
  durationMs?: number | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    nextCursor?: string | null;
    next?: string | null;
    hasMore?: boolean;
  };
}

// -------------------------------------------------------------------------
// 3. Privacy Scanner Types
// -------------------------------------------------------------------------
export type SensitiveCategory = 
  | 'EMAIL' 
  | 'PHONE' 
  | 'SECRET' 
  | 'CREDENTIAL_ASSIGNMENT' 
  | 'IP_ADDRESS' 
  | 'PAN' 
  | 'AADHAAR' 
  | 'CUSTOM';

export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface PrivacyFinding {
  category: SensitiveCategory;
  severity: SeverityLevel;
  action: PrivacyAction;
  messageIndex?: number;
  startIndex?: number;
  endIndex?: number;
  replacementToken?: string;
  ruleId?: string;
  description?: string;
}

export interface PrivacyScanResponse {
  scanId: string;
  requestId?: string;
  status: string;
  action: PrivacyAction;
  decision: string;
  findings: PrivacyFinding[];
  sanitizedMessages: ChatMessage[];
  durationMs: number;
  ruleSetVersion?: string;
}

export interface PrivacyConfig {
  organizationId: string;
  enabledCategories: SensitiveCategory[];
  maskingConfiguration?: Record<string, unknown>;
  ruleSetVersion?: string;
  status?: string;
}

export interface CustomPattern {
  id: string;
  name: string;
  pattern: string;
  severity: SeverityLevel;
  action: PrivacyAction;
  replacement?: string;
  enabled: boolean;
}

export interface ScannerLimitations {
  supportedCategories: SensitiveCategory[];
  regexLimits?: Record<string, unknown>;
  engineVersion?: string;
}

// -------------------------------------------------------------------------
// 4. Policy & Approval Types
// -------------------------------------------------------------------------
export interface PolicyCondition {
  field?: string;
  operator?: 'eq' | 'neq' | 'in' | 'notIn' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'gte' | 'lt' | 'lte' | 'has_role' | 'all' | 'any' | 'not';
  value?: unknown;
  conditions?: PolicyCondition[];
}

export interface PolicyRule {
  id: string;
  name: string;
  effect: 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL';
  reason?: string;
  condition: PolicyCondition;
  requiredApprovers?: string[];
}

export interface PolicyVersion {
  id?: string;
  version: number;
  rules: PolicyRule[];
  description?: string;
  createdAt?: string;
}

export interface Policy {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  category?: string;
  priority: number;
  status: 'ACTIVE' | 'INACTIVE';
  activeVersion: number;
  versions?: PolicyVersion[];
  createdAt?: string;
  updatedAt?: string;
}

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface ApprovalRequest {
  id: string;
  organizationId: string;
  requestId?: string;
  policyId?: string;
  policyVersion?: number;
  ruleId?: string;
  reason: string;
  modelRequested?: string;
  status: ApprovalStatus;
  requesterId?: string;
  requesterRole?: string;
  requesterType?: string;
  approverId?: string | null;
  approverRole?: string | null;
  decisionReason?: string | null;
  decisionAt?: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------------------
// 5. Model Provider Types
// -------------------------------------------------------------------------
export interface ProviderConfig {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'gemini' | 'mock' | 'custom';
  baseUrl?: string | null;
  apiKeyConfigured: boolean;
  apiKeyMasked?: string | null;
  enabled: boolean;
  isHealthy: boolean;
  isBuiltin?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProviderTestResult {
  healthy: boolean;
  latencyMs: number;
  message: string;
  providerId?: string;
}

export interface ModelConfig {
  modelId: string;
  provider: string;
  providerModelName: string;
  enabled: boolean;
  isDefault: boolean;
  maxTokens: number;
  contextWindow: number;
  defaultTemperature?: number;
  capabilities: string[];
  description?: string;
}

export interface UsageRecord {
  id: string;
  requestId?: string;
  traceId?: string;
  organizationId: string;
  callerId?: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  status: string;
  createdAt: string;
}

// -------------------------------------------------------------------------
// 6. Security & Audit Types
// -------------------------------------------------------------------------
export type AuditEventType = 
  | 'AI_REQUEST_ACCEPTED'
  | 'AI_REQUEST_COMPLETED'
  | 'AI_REQUEST_BLOCKED_PRIVACY'
  | 'AI_REQUEST_BLOCKED_POLICY'
  | 'AI_REQUEST_FAILED'
  | 'APPROVAL_REQUESTED'
  | 'APPROVAL_DECIDED'
  | 'POLICY_CREATED'
  | 'PRIVACY_SCAN_PERFORMED'
  | 'USER_LOGGED_IN'
  | 'TOKEN_REFRESHED';

export interface AuditEvent {
  eventId: string;
  eventVersion?: number;
  eventType: AuditEventType;
  occurredAt: string;
  ingestedAt: string;
  organizationId: string;
  sourceService?: string;
  requestId?: string;
  traceId?: string;
  callerId?: string;
  severity: SeverityLevel;
  outcome?: string;
  action?: string;
  reasonCode?: string;
  details?: Record<string, unknown>;
  integrity?: {
    digest: string;
    algorithm: string;
  };
}

export interface AuditTrace {
  traceId: string;
  requestId?: string;
  events: AuditEvent[];
}

export interface PipelineStage {
  id: string;
  name: string;
  service: string;
  servicePort: number;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'BLOCKED' | 'DENIED' | 'SKIPPED' | 'WAITING_FOR_APPROVAL' | 'FAILED';
  durationMs?: number;
}

export interface TraceTimelineStep {
  stepNumber: number;
  id: string;
  name: string;
  service: string;
  servicePort?: number;
  eventType: string;
  status: string;
  httpStatus?: number;
  decision?: string;
  timestamp: string;
  durationMs?: number;
  details?: Record<string, unknown>;
}

export interface EnrichedAiRequestTrace {
  requestId: string;
  traceId: string;
  organizationId: string;
  callerId: string;
  status: AiRequestStatus;
  modelSelected?: string;
  sanitizedPromptSummary?: string;
  sanitizedResult?: string;
  privacyAction?: string;
  policyDecision?: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
  durationMs?: number;
  pipelineStages: PipelineStage[];
  timeline: TraceTimelineStep[];
  events?: AuditEvent[];
}

export interface DigestVerificationResult {
  valid: boolean;
  eventId: string;
  digest: string;
  algorithm: string;
  recalculatedDigest?: string;
}
