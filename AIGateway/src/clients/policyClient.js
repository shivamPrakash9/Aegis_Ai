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
  async evaluate({ organizationId, principal, messages, modelPreference, requestId, correlationId }) {
    if (this._mockHandler) {
      return this._mockHandler({ organizationId, principal, messages, modelPreference, requestId, correlationId });
    }

    const url = `${this.baseUrl}/v1/evaluate`;
    const maxAttempts = 3;
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;
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
            modelPreference: modelPreference || {},
            requestId
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status >= 500 && attempt < maxAttempts) {
            const delay = 100 * Math.pow(2, attempt - 1);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
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
          if (attempt >= maxAttempts) throw err;
        }

        if (attempt < maxAttempts) {
          const delay = 100 * Math.pow(2, attempt - 1);
          logger.warn(
            { correlationId, attempt, maxAttempts, delayMs: delay, err: err.message },
            'Retrying Policy Service evaluate with exponential backoff'
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
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
  }

  /**
   * Retrieves status of an approval request from Policy & Approval Service.
   * @param {string} approvalId
   * @param {string} organizationId
   * @param {string} correlationId
   * @returns {Promise<{ id: string, status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED', decisionReason?: string }>}
   */
  async getApproval(approvalId, organizationId, correlationId) {
    if (this._mockApprovalHandler) {
      return this._mockApprovalHandler(approvalId, organizationId, correlationId);
    }

    const url = `${this.baseUrl}/v1/approvals/${encodeURIComponent(approvalId)}?organizationId=${encodeURIComponent(organizationId)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), env.requestTimeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Service-Key': process.env.INTERNAL_SERVICE_KEY || 'aegis_internal_service_key_dev_only',
          'X-Correlation-Id': correlationId || 'unknown'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.status === 404) {
        throw new BadGatewayError(`Approval request '${approvalId}' not found in Policy & Approval Service.`);
      }

      if (!response.ok) {
        throw new ServiceUnavailableError(
          `Policy Service returned HTTP status ${response.status} when checking approval.`
        );
      }

      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof BadGatewayError || err instanceof ServiceUnavailableError) {
        throw err;
      }

      logger.error(
        { correlationId, err: err.message, approvalId, service: 'PolicyService' },
        'Downstream failure during approval query'
      );

      throw new ServiceUnavailableError('Policy & Approval Service is currently unreachable.');
    }
  }

  setMockHandler(handler) {
    this._mockHandler = handler;
  }

  setMockApprovalHandler(handler) {
    this._mockApprovalHandler = handler;
  }

  resetMock() {
    this._mockHandler = null;
    this._mockApprovalHandler = null;
  }
}

const defaultPolicyClient = new PolicyClient();

module.exports = {
  PolicyClient,
  policyClient: defaultPolicyClient
};
