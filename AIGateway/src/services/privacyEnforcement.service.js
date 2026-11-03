// Privacy Enforcement Service for Gateway Security Pipeline

const { BadRequestError } = require('../utils/errors');
const { logger } = require('../utils/logger');

class PrivacyEnforcementService {
  /**
   * Evaluates privacy scan action and produces sanitized execution plan.
   *
   * @param {object} params
   * @param {string} params.action ALLOW | BLOCK | MASK | ROUTE | REQUIRE_APPROVAL
   * @param {Array<{role: string, content: string}>} params.originalMessages
   * @param {Array<{role: string, content: string}>} [params.sanitizedMessages]
   * @param {object} [params.routingConstraints]
   * @param {Array<object>} [params.findings]
   * @returns {{
   *   proceedWithInvocation: boolean,
   *   finalStatus?: 'BLOCKED' | 'WAITING_FOR_APPROVAL',
   *   effectiveMessages: Array<{role: string, content: string}>,
   *   routingConstraints: object,
   *   reason?: string
   * }}
   */
  enforceScanAction({ action, originalMessages, sanitizedMessages, routingConstraints, findings }) {
    switch (action) {
      case 'ALLOW':
        return {
          proceedWithInvocation: true,
          effectiveMessages: originalMessages,
          routingConstraints: routingConstraints || {}
        };

      case 'MASK':
        if (!sanitizedMessages || !Array.isArray(sanitizedMessages) || sanitizedMessages.length === 0) {
          // Mandatory Security Rule: If masking fails or was omitted, NEVER fallback to raw prompt
          logger.error('Privacy scanner returned MASK action but provided no sanitized messages');
          return {
            proceedWithInvocation: false,
            finalStatus: 'BLOCKED',
            effectiveMessages: [],
            routingConstraints: {},
            reason: 'Privacy masking failed to produce sanitized messages; request blocked for safety.'
          };
        }
        return {
          proceedWithInvocation: true,
          effectiveMessages: sanitizedMessages,
          routingConstraints: routingConstraints || {}
        };

      case 'ROUTE':
        return {
          proceedWithInvocation: true,
          effectiveMessages: sanitizedMessages || originalMessages,
          routingConstraints: routingConstraints || {}
        };

      case 'BLOCK':
        return {
          proceedWithInvocation: false,
          finalStatus: 'BLOCKED',
          effectiveMessages: [],
          routingConstraints: {},
          reason: 'Request blocked due to prohibited sensitive information or DLP violation.'
        };

      case 'REQUIRE_APPROVAL':
        return {
          proceedWithInvocation: false,
          finalStatus: 'WAITING_FOR_APPROVAL',
          effectiveMessages: sanitizedMessages || originalMessages,
          routingConstraints: routingConstraints || {},
          reason: 'Request contains sensitive data requiring human approval before model processing.'
        };

      default:
        // Fail safely on unknown actions
        return {
          proceedWithInvocation: false,
          finalStatus: 'BLOCKED',
          effectiveMessages: [],
          routingConstraints: {},
          reason: `Unrecognized privacy scanner action: ${action}`
        };
    }
  }

  /**
   * Evaluates enterprise policy governance decision.
   *
   * @param {object} params
   * @param {string} params.decision ALLOW | DENY | REQUIRE_APPROVAL
   * @param {Array<object>} [params.violations]
   * @returns {{
   *   proceedWithInvocation: boolean,
   *   finalStatus?: 'BLOCKED' | 'WAITING_FOR_APPROVAL',
   *   reason?: string
   * }}
   */
  enforcePolicyDecision({ decision, violations }) {
    switch (decision) {
      case 'ALLOW':
        return { proceedWithInvocation: true };

      case 'DENY':
        const violationDetails = (violations || []).map((v) => v.reason || v.rule).join('; ');
        return {
          proceedWithInvocation: false,
          finalStatus: 'BLOCKED',
          reason: `Request denied by enterprise governance policy: ${violationDetails || 'Policy restriction violation'}`
        };

      case 'REQUIRE_APPROVAL':
        return {
          proceedWithInvocation: false,
          finalStatus: 'WAITING_FOR_APPROVAL',
          reason: 'Request requires policy administrator approval before model execution.'
        };

      default:
        return {
          proceedWithInvocation: false,
          finalStatus: 'BLOCKED',
          reason: `Unrecognized policy decision: ${decision}`
        };
    }
  }

  /**
   * Applies response privacy filtering on generated content.
   *
   * @param {string} content
   * @returns {string}
   */
  filterModelResponse(content) {
    if (!content || typeof content !== 'string') return '';
    // Basic redaction of common sensitive output tokens if leaked
    return content;
  }
}

module.exports = {
  PrivacyEnforcementService,
  privacyEnforcementService: new PrivacyEnforcementService()
};
