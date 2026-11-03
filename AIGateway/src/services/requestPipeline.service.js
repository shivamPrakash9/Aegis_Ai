// Central Request Processing Pipeline Orchestrator

const { aiRequestRepository } = require('../repositories/aiRequest.repository');
const { privacyScannerClient } = require('../clients/privacyScannerClient');
const { policyClient } = require('../clients/policyClient');
const { modelProviderClient } = require('../clients/modelProviderClient');
const { securityAuditClient } = require('../clients/securityAuditClient');
const { privacyEnforcementService } = require('./privacyEnforcement.service');
const { idempotencyService } = require('./idempotency.service');
const { rateLimiterService } = require('./rateLimiter.service');
const { generateRequestId, generateTraceId } = require('../utils/correlationId');
const { logger } = require('../utils/logger');
const {
  BadRequestError,
  ServiceUnavailableError,
  BadGatewayError
} = require('../utils/errors');

class RequestPipelineService {
  constructor(
    repo = aiRequestRepository,
    scanner = privacyScannerClient,
    policy = policyClient,
    model = modelProviderClient,
    audit = securityAuditClient,
    enforcer = privacyEnforcementService,
    idempotency = idempotencyService,
    rateLimiter = rateLimiterService
  ) {
    this.repo = repo;
    this.scanner = scanner;
    this.policy = policy;
    this.model = model;
    this.audit = audit;
    this.enforcer = enforcer;
    this.idempotency = idempotency;
    this.rateLimiter = rateLimiter;
  }

  /**
   * Executes the full 16-step request processing pipeline.
   *
   * @param {object} params
   * @param {object} params.principal Verified caller principal
   * @param {string} params.organizationId Verified caller organization ID
   * @param {string} params.idempotencyKey Header Idempotency-Key
   * @param {object} params.payload Request body { messages, modelPreference, metadata }
   * @param {string} params.correlationId Request correlation ID
   * @returns {Promise<{
   *   statusCode: number,
   *   body: {
   *     requestId: string,
   *     status: string,
   *     traceId: string,
   *     createdAt: string,
   *     statusUrl: string
   *   }
   * }>}
   */
  async processAiRequest({ principal, organizationId, idempotencyKey, payload, correlationId }) {
    const requestId = generateRequestId();
    const traceId = generateTraceId();

    // 1 & 2. Correlation ID & Auth context established by caller/middleware.
    // 3. Organization context established from verified principal.
    // 4. Input validated via AJV schema.

    // 5. Check Idempotency Coordination
    const idempotencyCheck = await this.idempotency.checkOrReserve({
      organizationId,
      idempotencyKey,
      payload,
      requestId,
      traceId
    });

    if (idempotencyCheck.isExisting && idempotencyCheck.cachedResponse) {
      logger.info(
        { correlationId, organizationId, idempotencyKey },
        'Returning cached outcome for idempotent request'
      );
      return {
        statusCode: 202,
        body: idempotencyCheck.cachedResponse
      };
    }

    // 6. Enforce Organization and Caller Rate Limits
    await this.rateLimiter.checkRateLimit(organizationId, principal.id);

    // 7. Persist Initial Durable Record in aegis_gateway (Status: ACCEPTED)
    const initialRecord = await this.repo.create({
      id: requestId,
      organizationId,
      callerId: principal.id,
      callerType: principal.type || 'USER',
      status: 'ACCEPTED',
      traceId,
      idempotencyKey,
      payloadFingerprint: this.idempotency.computeFingerprint(payload),
      metadata: payload.metadata
    });

    const acceptedResponse = {
      requestId: initialRecord.id,
      status: 'ACCEPTED',
      traceId: initialRecord.traceId,
      createdAt: initialRecord.createdAt.toISOString(),
      statusUrl: `/v1/ai-requests/${initialRecord.id}`
    };

    // Commit accepted response to idempotency store
    await this.idempotency.commitResponse({
      organizationId,
      idempotencyKey,
      payload,
      responsePayload: acceptedResponse
    });

    // Emit initial lifecycle audit event
    await this.audit.emitSecurityEvent({
      eventType: 'AI_REQUEST_ACCEPTED',
      traceId,
      requestId,
      organizationId,
      callerId: principal.id,
      severity: 'INFO',
      correlationId
    });

    // 8 & 9. Privacy Scanner Evaluation & Decision Enforcement
    let scanResult;
    try {
      scanResult = await this.scanner.scan({
        messages: payload.messages,
        organizationId,
        correlationId
      });
    } catch (scannerErr) {
      // Update DB to FAILED safely
      await this.repo.updateStatus(requestId, organizationId, 'FAILED', {
        errorCode: 'PRIVACY_SCANNER_UNAVAILABLE',
        errorMessage: scannerErr.message
      });
      throw scannerErr;
    }

    const privacyEnforcement = this.enforcer.enforceScanAction({
      action: scanResult.action,
      originalMessages: payload.messages,
      sanitizedMessages: scanResult.sanitizedMessages,
      routingConstraints: scanResult.routingConstraints,
      findings: scanResult.findings
    });

    if (!privacyEnforcement.proceedWithInvocation) {
      const finalStatus = privacyEnforcement.finalStatus || 'BLOCKED';
      await this.repo.updateStatus(requestId, organizationId, finalStatus, {
        privacyAction: scanResult.action,
        errorCode: finalStatus === 'BLOCKED' ? 'PRIVACY_POLICY_BLOCK' : undefined,
        errorMessage: privacyEnforcement.reason
      });

      await this.audit.emitSecurityEvent({
        eventType: finalStatus === 'BLOCKED' ? 'AI_REQUEST_BLOCKED_PRIVACY' : 'AI_REQUEST_WAITING_APPROVAL',
        traceId,
        requestId,
        organizationId,
        callerId: principal.id,
        severity: finalStatus === 'BLOCKED' ? 'WARN' : 'INFO',
        details: { action: scanResult.action, reason: privacyEnforcement.reason },
        correlationId
      });

      return {
        statusCode: 202,
        body: acceptedResponse
      };
    }

    // 10 & 11. Policy & Governance Evaluation
    let policyResult;
    try {
      policyResult = await this.policy.evaluate({
        organizationId,
        principal,
        messages: privacyEnforcement.effectiveMessages,
        modelPreference: payload.modelPreference,
        requestId,
        correlationId
      });
    } catch (policyErr) {
      await this.repo.updateStatus(requestId, organizationId, 'FAILED', {
        errorCode: 'POLICY_SERVICE_UNAVAILABLE',
        errorMessage: policyErr.message
      });
      throw policyErr;
    }

    const policyEnforcement = this.enforcer.enforcePolicyDecision({
      decision: policyResult.decision,
      violations: policyResult.violations
    });

    if (!policyEnforcement.proceedWithInvocation) {
      const finalStatus = policyEnforcement.finalStatus || 'BLOCKED';
      const approvalMeta = {
        ...(payload.metadata || {}),
        approvalId: policyResult.approvalId || null,
        effectiveMessages: privacyEnforcement.effectiveMessages,
        modelPreference: payload.modelPreference || {},
        routingConstraints: privacyEnforcement.routingConstraints || {}
      };

      await this.repo.updateStatus(requestId, organizationId, finalStatus, {
        policyDecision: policyResult.decision,
        metadata: approvalMeta,
        errorCode: finalStatus === 'BLOCKED' ? 'GOVERNANCE_POLICY_DENIAL' : undefined,
        errorMessage: policyEnforcement.reason
      });

      await this.audit.emitSecurityEvent({
        eventType: finalStatus === 'BLOCKED' ? 'AI_REQUEST_BLOCKED_POLICY' : 'AI_REQUEST_WAITING_APPROVAL',
        traceId,
        requestId,
        organizationId,
        callerId: principal.id,
        severity: finalStatus === 'BLOCKED' ? 'WARN' : 'INFO',
        details: { decision: policyResult.decision, reason: policyEnforcement.reason },
        correlationId
      });

      return {
        statusCode: 202,
        body: acceptedResponse
      };
    }

    // 12. Model & Provider Invocation (Permitted ONLY after Privacy & Policy clearance)
    await this.repo.updateStatus(requestId, organizationId, 'PROCESSING', {
      privacyAction: scanResult.action,
      policyDecision: policyResult.decision
    });

    try {
      const modelResult = await this.model.invokeModel({
        messages: privacyEnforcement.effectiveMessages,
        modelPreference: payload.modelPreference,
        routingConstraints: privacyEnforcement.routingConstraints,
        organizationId,
        traceId,
        correlationId
      });

      // 13. Apply response privacy filtering
      const rawContent =
        modelResult.choices?.[0]?.message?.content ??
        modelResult.choices?.[0]?.text ??
        modelResult.content ??
        modelResult.result ??
        modelResult.response ??
        '';
      const safeSanitizedContent = this.enforcer.filterModelResponse(rawContent);

      const promptSummary = (privacyEnforcement.effectiveMessages || [])
        .map((m) => `[${m.role}]: ${m.content}`)
        .join('\n');

      // 14. Persist Final Safe Status and Sanitized Result Metadata
      await this.repo.updateStatus(requestId, organizationId, 'COMPLETED', {
        modelSelected: modelResult.model || payload.modelPreference?.model || 'default-model',
        sanitizedPromptSummary: promptSummary,
        sanitizedResult: safeSanitizedContent
      });

      // 15. Record privacy-safe completion event in Security & Audit Service
      await this.audit.emitSecurityEvent({
        eventType: 'AI_REQUEST_COMPLETED',
        traceId,
        requestId,
        organizationId,
        callerId: principal.id,
        severity: 'INFO',
        details: {
          model: modelResult.model,
          provider: modelResult.provider,
          tokens: modelResult.usage?.totalTokens
        },
        correlationId
      });
    } catch (modelErr) {
      logger.error(
        { correlationId, requestId, traceId, err: modelErr.message },
        'Model invocation failure during processing'
      );

      await this.repo.updateStatus(requestId, organizationId, 'FAILED', {
        errorCode: modelErr.code || 'MODEL_INVOCATION_FAILED',
        errorMessage: modelErr.message
      });

      await this.audit.emitSecurityEvent({
        eventType: 'AI_REQUEST_FAILED',
        traceId,
        requestId,
        organizationId,
        callerId: principal.id,
        severity: 'WARN',
        details: { error: modelErr.message },
        correlationId
      });

      throw modelErr;
    }

    // 16. Return Accepted response envelope
    return {
      statusCode: 202,
      body: acceptedResponse
    };
  }

  /**
   * Resumes an AI Request previously waiting for human approval.
   *
   * @param {object} params
   * @param {string} params.requestId
   * @param {string} params.organizationId
   * @param {object} params.principal
   * @param {string} params.correlationId
   * @returns {Promise<object>}
   */
  async resumeRequest({ requestId, organizationId, principal, correlationId }) {
    const existing = await this.repo.findById(requestId, organizationId);
    if (!existing) {
      throw new BadRequestError(`AI Request with ID '${requestId}' not found in caller organization.`);
    }

    if (existing.status !== 'WAITING_FOR_APPROVAL') {
      throw new BadRequestError(`Cannot resume request with status '${existing.status}'. Expected 'WAITING_FOR_APPROVAL'.`);
    }

    let meta = {};
    try {
      meta = typeof existing.metadata === 'string' ? JSON.parse(existing.metadata) : (existing.metadata || {});
    } catch {
      meta = {};
    }

    const approvalId = meta.approvalId;
    if (!approvalId) {
      throw new BadRequestError('No approvalId associated with this waiting request.');
    }

    // Check approval status in PolicyApproval service
    const approval = await this.policy.getApproval(approvalId, organizationId, correlationId);

    if (approval.status === 'PENDING') {
      return {
        statusCode: 200,
        body: {
          requestId: existing.id,
          status: 'WAITING_FOR_APPROVAL',
          approvalStatus: 'PENDING',
          message: 'Approval is still pending review.'
        }
      };
    }

    if (approval.status === 'REJECTED') {
      await this.repo.updateStatus(requestId, organizationId, 'BLOCKED', {
        errorMessage: `Request rejected by approver: ${approval.decisionReason || 'Denied'}`
      });

      await this.audit.emitSecurityEvent({
        eventType: 'AI_REQUEST_BLOCKED_POLICY',
        traceId: existing.traceId,
        requestId: existing.id,
        organizationId,
        callerId: principal.id,
        severity: 'WARN',
        details: { reason: approval.decisionReason || 'Approval rejected' },
        correlationId
      });

      return {
        statusCode: 200,
        body: {
          requestId: existing.id,
          status: 'BLOCKED',
          approvalStatus: 'REJECTED',
          message: 'Request was rejected by designated reviewer.'
        }
      };
    }

    if (approval.status === 'APPROVED') {
      // Proceed with Model Invocation
      await this.repo.updateStatus(requestId, organizationId, 'PROCESSING');

      const effectiveMessages = meta.effectiveMessages || [];
      const modelPreference = meta.modelPreference || {};
      const routingConstraints = meta.routingConstraints || {};

      try {
        const modelResult = await this.model.invokeModel({
          messages: effectiveMessages,
          modelPreference,
          routingConstraints,
          organizationId,
          traceId: existing.traceId,
          correlationId
        });

        const rawContent =
          modelResult.choices?.[0]?.message?.content ??
          modelResult.choices?.[0]?.text ??
          modelResult.content ??
          modelResult.result ??
          modelResult.response ??
          '';
        const safeSanitizedContent = this.enforcer.filterModelResponse(rawContent);

        const promptSummary = (effectiveMessages || [])
          .map((m) => `[${m.role}]: ${m.content}`)
          .join('\n');

        await this.repo.updateStatus(requestId, organizationId, 'COMPLETED', {
          modelSelected: modelResult.model || modelPreference.model || 'default-model',
          sanitizedPromptSummary: promptSummary,
          sanitizedResult: safeSanitizedContent
        });

        await this.audit.emitSecurityEvent({
          eventType: 'AI_REQUEST_COMPLETED',
          traceId: existing.traceId,
          requestId: existing.id,
          organizationId,
          callerId: principal.id,
          severity: 'INFO',
          details: {
            model: modelResult.model,
            provider: modelResult.provider,
            tokens: modelResult.usage?.totalTokens
          },
          correlationId
        });

        return {
          statusCode: 200,
          body: {
            requestId: existing.id,
            status: 'COMPLETED',
            approvalStatus: 'APPROVED',
            modelSelected: modelResult.model,
            sanitizedResult: safeSanitizedContent
          }
        };
      } catch (modelErr) {
        await this.repo.updateStatus(requestId, organizationId, 'FAILED', {
          errorCode: modelErr.code || 'MODEL_INVOCATION_FAILED',
          errorMessage: modelErr.message
        });

        await this.audit.emitSecurityEvent({
          eventType: 'AI_REQUEST_FAILED',
          traceId: existing.traceId,
          requestId: existing.id,
          organizationId,
          callerId: principal.id,
          severity: 'WARN',
          details: { error: modelErr.message },
          correlationId
        });

        throw modelErr;
      }
    }

    return {
      statusCode: 200,
      body: {
        requestId: existing.id,
        status: existing.status,
        approvalStatus: approval.status
      }
    };
  }
}

module.exports = {
  RequestPipelineService,
  requestPipelineService: new RequestPipelineService()
};
