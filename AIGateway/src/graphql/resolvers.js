// GraphQL Resolvers for AegisAI Gateway
// Reuses existing database layers, enforces authentication and organization isolation

const { aiRequestRepository } = require('../repositories/aiRequest.repository');
const { aiRequestService } = require('../services/aiRequest.service');
const { securityAuditClient } = require('../clients/securityAuditClient');

const rootResolvers = {
  me: (_args, context) => {
    if (!context.principal) {
      throw new Error('Unauthorized');
    }
    return {
      id: context.principal.id,
      email: context.principal.email || `${context.principal.id}@aegisai.internal`,
      role: context.principal.role,
      organizationId: context.organizationId
    };
  },

  organization: (_args, context) => {
    if (!context.organizationId) {
      throw new Error('Unauthorized');
    }
    return {
      id: context.organizationId,
      name: context.organizationName || 'Default Organization',
      slug: 'default-org',
      status: 'ACTIVE'
    };
  },

  models: () => {
    return [
      { id: 'gpt-4o', name: 'GPT-4o Enterprise', provider: 'openai', contextWindow: 128000, description: 'High-intelligence flagship model' },
      { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'anthropic', contextWindow: 200000, description: 'State-of-the-art vision and reasoning' },
      { id: 'mistral-large', name: 'Mistral Large 2', provider: 'mistral', contextWindow: 128000, description: 'Flagship open-weights enterprise model' },
      { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', provider: 'groq', contextWindow: 128000, description: 'Ultra-low latency open architecture' },
      { id: 'mock-llm', name: 'Deterministic Mock LLM', provider: 'mock', contextWindow: 32000, description: 'In-process test provider' }
    ];
  },

  policies: () => {
    return [
      { id: 'pol_default_pii', name: 'Strict PII Prevention Policy', action: 'BLOCK', description: 'Blocks requests containing unmasked credit cards or SSNs' },
      { id: 'pol_budget_cap', name: 'High-Cost Inference Threshold', action: 'REQUIRE_APPROVAL', description: 'Requires oversight for requests exceeding 16k tokens' }
    ];
  },

  aiRequests: async (args, context) => {
    if (!context.organizationId) {
      throw new Error('Unauthorized');
    }

    const isOrgAdmin = ['ORGANIZATION_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(context.principal?.role);
    const filter = {
      ...(args.status ? { status: args.status } : {}),
      ...(!isOrgAdmin ? { callerId: context.principal?.id } : {})
    };

    const limit = Math.min(100, Math.max(1, args.limit || 20));
    const result = await aiRequestRepository.findMany(context.organizationId, filter, {
      page: 1,
      limit,
      cursor: args.cursor
    });

    const items = result.items.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      callerId: r.callerId,
      status: r.status,
      modelSelected: r.modelSelected,
      sanitizedPromptSummary: r.sanitizedPromptSummary,
      sanitizedResult: r.sanitizedResult,
      traceId: r.traceId,
      privacyAction: r.privacyAction,
      policyDecision: r.policyDecision,
      errorCode: r.errorCode,
      errorMessage: r.errorMessage,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
      completedAt: r.completedAt ? new Date(r.completedAt).toISOString() : null
    }));

    return {
      items,
      nextCursor: result.nextCursor || null,
      total: result.total,
      hasMore: Boolean(result.nextCursor || (result.page < result.totalPages))
    };
  },

  aiRequest: async (args, context) => {
    if (!context.organizationId) {
      throw new Error('Unauthorized');
    }
    const isOrgAdmin = ['ORGANIZATION_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(context.principal?.role);
    const callerId = isOrgAdmin ? null : context.principal?.id;

    const req = await aiRequestRepository.findById(args.id, context.organizationId, callerId);
    if (!req) return null;

    return {
      id: req.id,
      organizationId: req.organizationId,
      callerId: req.callerId,
      status: req.status,
      modelSelected: req.modelSelected,
      sanitizedPromptSummary: req.sanitizedPromptSummary,
      sanitizedResult: req.sanitizedResult,
      traceId: req.traceId,
      privacyAction: req.privacyAction,
      policyDecision: req.policyDecision,
      errorCode: req.errorCode,
      errorMessage: req.errorMessage,
      createdAt: req.createdAt ? new Date(req.createdAt).toISOString() : new Date().toISOString(),
      completedAt: req.completedAt ? new Date(req.completedAt).toISOString() : null
    };
  },

  aiRequestTrace: async (args, context) => {
    if (!context.organizationId) {
      throw new Error('Unauthorized');
    }
    const isOrgAdmin = ['ORGANIZATION_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(context.principal?.role);
    const callerId = isOrgAdmin ? null : context.principal?.id;

    const req = await aiRequestRepository.findById(args.id, context.organizationId, callerId);
    if (!req) return null;

    let events = [];
    try {
      const traceData = await securityAuditClient.getTrace(
        req.traceId,
        context.organizationId,
        context.correlationId || 'graphql'
      );
      events = (traceData.events || []).map((e) => ({
        eventId: e.eventId,
        eventType: e.eventType,
        timestamp: new Date(e.timestamp || e.occurredAt || Date.now()).toISOString(),
        severity: e.severity || 'INFO',
        outcome: e.outcome || null,
        action: e.action || null,
        sourceService: e.sourceService || 'gateway'
      }));
    } catch {
      events = [];
    }

    return {
      requestId: req.id,
      traceId: req.traceId,
      events
    };
  },

  submitAiRequest: async (args, context) => {
    if (!context.principal) {
      throw new Error('Unauthorized');
    }
    const idempotencyKey = args.input.idempotencyKey || `gql_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const result = await aiRequestService.submitRequest({
      principal: context.principal,
      organizationId: context.organizationId,
      idempotencyKey,
      payload: {
        messages: args.input.messages,
        modelPreference: args.input.modelPreference ? { model: args.input.modelPreference } : undefined
      },
      correlationId: context.correlationId || 'graphql'
    });

    return {
      requestId: result.body.requestId,
      status: result.body.status,
      traceId: result.body.traceId,
      statusUrl: result.body.statusUrl
    };
  }
};

module.exports = {
  rootResolvers
};

