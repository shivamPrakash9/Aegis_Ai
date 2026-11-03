// Policy Evaluation Service

const { policyRepository } = require('../repositories/policy.repository');
const { approvalRepository } = require('../repositories/approval.repository');
const { matchRules } = require('../policy-engine/ruleMatcher');
const { resolveDecision } = require('../policy-engine/decisionResolver');
const { generateEvaluationId } = require('../utils/correlationId');
const { BadRequestError } = require('../utils/errors');
const { logger } = require('../utils/logger');

class PolicyEvaluationService {
  constructor({
    policyRepo = policyRepository,
    approvalRepo = approvalRepository
  } = {}) {
    this.policyRepo = policyRepo;
    this.approvalRepo = approvalRepo;
  }

  /**
   * Normalizes inbound evaluation request.
   */
  normalizeInput(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestError('Evaluation payload must be an object.');
    }

    const organizationId = payload.organizationId;
    if (!organizationId || typeof organizationId !== 'string') {
      throw new BadRequestError('Evaluation request must specify a valid organizationId.');
    }

    const principal = payload.principal || {};
    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    const modelPreference = payload.modelPreference || {};
    const metadata = payload.metadata || {};

    return {
      organizationId,
      principal,
      messages,
      modelPreference,
      metadata,
      requestId: payload.requestId || null
    };
  }

  /**
   * Builds evaluation context for rule conditions.
   */
  buildContext({ principal, messages, modelPreference, metadata }) {
    let totalPromptLength = 0;
    for (const m of messages) {
      if (m && typeof m.content === 'string') {
        totalPromptLength += m.content.length;
      }
    }

    return {
      model: modelPreference.model || '',
      provider: modelPreference.provider || '',
      callerRole: principal.role || '',
      callerId: principal.id || '',
      callerType: principal.type || 'USER',
      permissions: Array.isArray(principal.permissions) ? principal.permissions : [],
      messageCount: messages.length,
      totalPromptLength,
      metadata
    };
  }

  /**
   * Evaluates incoming request against all applicable active policies.
   *
   * @param {object} rawPayload
   * @param {object} [options]
   * @param {string} [options.correlationId]
   * @returns {Promise<object>} Gateway-compatible evaluation decision
   */
  async evaluate(rawPayload, { correlationId = 'unknown' } = {}) {
    const evaluationId = generateEvaluationId();
    const {
      organizationId,
      principal,
      messages,
      modelPreference,
      metadata,
      requestId
    } = this.normalizeInput(rawPayload);

    // 1. Retrieve active policies for organization
    const activePolicies = await this.policyRepo.findActiveByOrganization(organizationId);

    // 2. Build context
    const context = this.buildContext({ principal, messages, modelPreference, metadata });

    // 3. Match rules across active policies
    const evaluatedPolicies = [];

    for (const pol of activePolicies) {
      const matched = matchRules(pol.rules || [], context);
      if (matched.length > 0) {
        evaluatedPolicies.push({
          policyId: pol.id,
          policyName: pol.name,
          policyVersion: pol.versionNumber || pol.activeVersion || 1,
          matchedRules: matched
        });
      }
    }

    // 4. Resolve decision precedence (DENY > REQUIRE_APPROVAL > ALLOW)
    const decisionResult = resolveDecision(evaluatedPolicies);

    // 5. If REQUIRE_APPROVAL, create durable approval request
    let approvalId = undefined;
    if (decisionResult.decision === 'REQUIRE_APPROVAL') {
      try {
        const approvalRecord = await this.approvalRepo.createApproval({
          organizationId,
          requestId,
          policyId: decisionResult.triggeringPolicyId,
          policyVersion: decisionResult.policyVersion,
          ruleId: decisionResult.triggeringRuleId,
          reason: decisionResult.reason,
          modelRequested: modelPreference.model || 'unknown',
          requesterId: principal.id || 'anonymous',
          requesterRole: principal.role || 'USER',
          requesterType: principal.type || 'USER'
        });
        approvalId = approvalRecord.id;
      } catch (apprErr) {
        logger.error({ correlationId, err: apprErr.message }, 'Failed to record approval request');
        // Fail-closed: if recording approval fails, do NOT allow request through
        throw apprErr;
      }
    }

    logger.info(
      {
        correlationId,
        evaluationId,
        organizationId,
        decision: decisionResult.decision,
        reasonCode: decisionResult.reasonCode,
        violationCount: decisionResult.violations.length,
        approvalId
      },
      'Policy governance evaluation completed'
    );

    // 6. Return response matching AI Gateway client contract
    return {
      decision: decisionResult.decision,
      policyVersion: decisionResult.policyVersion,
      reasonCode: decisionResult.reasonCode,
      reason: decisionResult.reason,
      violations: decisionResult.violations,
      requiredApprovers: decisionResult.requiredApprovers,
      approvalId,
      evaluationId
    };
  }
}

module.exports = {
  PolicyEvaluationService,
  policyEvaluationService: new PolicyEvaluationService()
};
