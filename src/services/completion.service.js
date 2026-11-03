// Completion Orchestration Service

const { providerRegistry } = require('./providerRegistry.service');
const { modelManagementService } = require('./modelManagement.service');
const { usageRepository } = require('../repositories/usage.repository');
const { BadRequestError } = require('../utils/errors');
const { logger } = require('../utils/logger');
const { env } = require('../config/env');

const ALLOWED_ROLES = new Set(['user', 'assistant', 'system', 'developer', 'tool']);

class CompletionService {
  constructor({ registry = providerRegistry, usageRepo = usageRepository } = {}) {
    this.registry = registry;
    this.usageRepo = usageRepo;
  }

  /**
   * Normalizes inbound chat completion payload from Gateway or direct client.
   *
   * @param {object} payload
   * @returns {object} normalized request params
   */
  normalizeInput(payload = {}) {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestError('Request body must be a JSON object.');
    }

    // 1. Extract messages
    const messages = payload.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new BadRequestError('Field \'messages\' must be a non-empty array.');
    }

    if (messages.length > 100) {
      throw new BadRequestError('Messages array exceeds maximum limit of 100 items.');
    }

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (!m || typeof m !== 'object') {
        throw new BadRequestError(`Message at index ${i} must be an object.`);
      }
      if (!m.role || !ALLOWED_ROLES.has(m.role.toLowerCase())) {
        throw new BadRequestError(
          `Message at index ${i} has invalid role '${m.role}'. Allowed: user, assistant, system, developer, tool.`
        );
      }
      if (typeof m.content !== 'string' || m.content.length === 0) {
        throw new BadRequestError(`Message at index ${i} must contain non-empty string 'content'.`);
      }
      if (m.content.length > 50000) {
        throw new BadRequestError(`Message at index ${i} content exceeds maximum limit of 50,000 characters.`);
      }
    }

    // 2. Resolve requested model
    let model = payload.model;
    let preferredProvider = undefined;

    if (!model && payload.modelPreference && typeof payload.modelPreference === 'object') {
      model = payload.modelPreference.model;
      preferredProvider = payload.modelPreference.provider;
    }

    if (!model) {
      model = env.defaultModel;
    }

    // 3. Extract routing constraints
    const routingConstraints = payload.routingConstraints || {};
    const allowedProviders = Array.isArray(routingConstraints.allowedProviders)
      ? routingConstraints.allowedProviders
      : undefined;

    // 4. Extract sampling parameters
    const temperature = typeof payload.temperature === 'number'
      ? Math.max(0, Math.min(2, payload.temperature))
      : undefined;

    const maxTokens = typeof payload.max_tokens === 'number'
      ? payload.max_tokens
      : typeof payload.maxTokens === 'number'
      ? payload.maxTokens
      : undefined;

    // 5. Extract operational context
    const organizationId = payload.organizationId;
    if (!organizationId || typeof organizationId !== 'string') {
      throw new BadRequestError('Field \'organizationId\' is required.');
    }

    const callerId = payload.callerId || payload.principal?.id || null;
    const requestId = payload.requestId || null;
    const traceId = payload.traceId || null;

    return {
      model,
      preferredProvider,
      allowedProviders,
      messages,
      temperature,
      maxTokens,
      stop: payload.stop,
      organizationId,
      callerId,
      requestId,
      traceId
    };
  }

  /**
   * Primary completion handler: resolves model, invokes provider adapter, and records usage.
   *
   * @param {object} rawPayload
   * @param {object} [context]
   * @param {string} [context.correlationId]
   * @param {string} [context.traceId]
   * @returns {Promise<object>} normalized completion response
   */
  async createChatCompletion(rawPayload, { correlationId = 'unknown', traceId } = {}) {
    const params = this.normalizeInput(rawPayload);
    const effectiveTraceId = traceId || params.traceId || 'unknown';

    // 0. Ensure database configurations are synchronized
    await modelManagementService._syncWithDatabase().catch(() => {});

    // 1. Resolve model & provider from registry
    const { modelConfig, provider } = this.registry.resolveModel(params.model, {
      preferredProvider: params.preferredProvider,
      allowedProviders: params.allowedProviders
    });

    const startTime = Date.now();
    let response;
    let status = 'COMPLETED';
    let errorCode = null;

    try {
      // 2. Outbound completion invocation
      response = await provider.invokeCompletion({
        model: modelConfig.providerModelName || modelConfig.modelId,
        messages: params.messages,
        temperature: params.temperature ?? modelConfig.defaultTemperature,
        maxTokens: params.maxTokens ?? modelConfig.maxTokens,
        stop: params.stop,
        correlationId,
        traceId: effectiveTraceId
      });

      // Ensure response.model reflects requested public model name
      response.model = modelConfig.modelId;
      response.provider = provider.id;

      return response;
    } catch (err) {
      status = 'FAILED';
      errorCode = err.code || 'PROVIDER_ERROR';
      throw err;
    } finally {
      const latencyMs = Date.now() - startTime;
      const promptTokens = response?.usage?.promptTokens || 0;
      const completionTokens = response?.usage?.completionTokens || 0;
      const totalTokens = response?.usage?.totalTokens || (promptTokens + completionTokens);

      // 3. Persist operational usage record asynchronously
      this.usageRepo
        .recordUsage({
          requestId: params.requestId,
          traceId: effectiveTraceId,
          organizationId: params.organizationId,
          callerId: params.callerId,
          provider: provider.id,
          model: modelConfig.modelId,
          promptTokens,
          completionTokens,
          totalTokens,
          latencyMs,
          status,
          errorCode
        })
        .catch((repoErr) => {
          logger.warn({ err: repoErr.message }, 'Failed to record usage telemetry');
        });

      // 4. Safe observability logging (zero prompts or completions)
      logger.info(
        {
          correlationId,
          traceId: effectiveTraceId,
          organizationId: params.organizationId,
          model: modelConfig.modelId,
          provider: provider.id,
          status,
          latencyMs,
          totalTokens
        },
        'Model completion request processed'
      );
    }
  }
}

module.exports = {
  CompletionService,
  completionService: new CompletionService()
};
