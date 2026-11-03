// Policy & Approval Service REST Client Integration

const { env } = require('../config/env');
const { ServiceUnavailableError, BadGatewayError } = require('../utils/errors');
const { logger } = require('../utils/logger');

class PolicyClient {
  constructor(baseUrl = env.policyServiceUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this._mockHandler = null;
  }

  /**
   * Evaluates enterprise governance policies against the scanned request and model preference.
   * @param {object} params
   * @param {string} params.organizationId
   * @param {object} params.principal
   * @param {Array<{role: string, content: string}>} params.messages
   * @param {object} [params.modelPreference]
   * @param {string} params.correlationId
   * @returns {Promise<{
   *   decision: 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL',
   *   violations?: Array<{policyId: string, rule: string, reason: string}>,
   *   requiredApprovers?: Array<string>
   * }>}
   */
  async evaluate({ organizationId, principal, messages, modelPreference, correlationId }) {
    if (this._mockHandler) {
      return this._mockHandler({ organizationId, principal, messages, modelPreference, correlationId });
    }

    const url = `${this.baseUrl}/v1/evaluate`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), env.requestTimeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-Id': correlationId || 'unknown'
        },
        body: JSON.stringify({
          organizationId,
          principal,
          messages,
          modelPreference: modelPreference || {}
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new ServiceUnavailableError(
          `Policy Service returned HTTP status ${response.status}. Mandatory governance check failed.`
        );
      }

      const data = await response.json();

      if (!data || !data.decision) {
        throw new BadGatewayError('Policy Service returned an invalid or empty decision payload.');
      }

      const validDecisions = ['ALLOW', 'DENY', 'REQUIRE_APPROVAL'];
      if (!validDecisions.includes(data.decision)) {
        throw new BadGatewayError(`Policy Service returned unrecognized decision: ${data.decision}`);
      }

      return data;
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof ServiceUnavailableError || err instanceof BadGatewayError) {
        throw err;
      }

      logger.error(
        { correlationId, err: err.message, service: 'PolicyService' },
        'Downstream failure during policy evaluation'
      );

      // Mandatory Governance Rule: NEVER bypass policy when service is unavailable
      throw new ServiceUnavailableError(
        'Policy & Approval Service is currently unreachable. Request aborted to maintain governance boundaries.'
      );
    }
  }

  setMockHandler(handler) {
    this._mockHandler = handler;
  }

  resetMock() {
    this._mockHandler = null;
  }
}

const defaultPolicyClient = new PolicyClient();

module.exports = {
  PolicyClient,
  policyClient: defaultPolicyClient
};
