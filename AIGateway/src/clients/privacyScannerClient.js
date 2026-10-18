// Privacy Scanner Service REST Client Integration

const { env } = require('../config/env');
const { ServiceUnavailableError, BadGatewayError } = require('../utils/errors');
const { logger } = require('../utils/logger');

class PrivacyScannerClient {
  constructor(baseUrl = env.privacyScannerUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this._mockHandler = null;
  }

  /**
   * Scans input messages for PII, secrets, or sensitive data.
   * @param {object} params
   * @param {Array<{role: string, content: string}>} params.messages
   * @param {string} params.organizationId
   * @param {string} params.correlationId
   * @returns {Promise<{
   *   action: 'ALLOW' | 'BLOCK' | 'MASK' | 'ROUTE' | 'REQUIRE_APPROVAL',
   *   sanitizedMessages?: Array<{role: string, content: string}>,
   *   findings?: Array<{type: string, severity: string, description: string}>,
   *   routingConstraints?: object
   * }>}
   */
  async scan({ messages, organizationId, correlationId }) {
    if (this._mockHandler) {
      return this._mockHandler({ messages, organizationId, correlationId });
    }

    const url = `${this.baseUrl}/v1/scan`;
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
          messages,
          organizationId
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new ServiceUnavailableError(
          `Privacy Scanner service returned error status ${response.status}. Security boundary enforced: request halted.`
        );
      }

      const data = await response.json();

      if (!data || !data.action) {
        throw new BadGatewayError('Privacy Scanner returned an invalid or empty decision.');
      }

      const validActions = ['ALLOW', 'BLOCK', 'MASK', 'ROUTE', 'REQUIRE_APPROVAL'];
      if (!validActions.includes(data.action)) {
        throw new BadGatewayError(`Privacy Scanner returned unrecognized action: ${data.action}`);
      }

      return data;
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof ServiceUnavailableError || err instanceof BadGatewayError) {
        throw err;
      }

      logger.error(
        { correlationId, err: err.message, service: 'PrivacyScanner' },
        'Downstream failure during privacy scan'
      );

      // Mandatory Security Rule: NEVER forward unscanned content to a provider
      throw new ServiceUnavailableError(
        'Privacy Scanner Service is currently unreachable. Request cannot be securely evaluated and has been aborted.'
      );
    }
  }

  /**
   * Attaches a mock handler for testing without a live Privacy Scanner service.
   * @param {Function} handler
   */
  setMockHandler(handler) {
    this._mockHandler = handler;
  }

  resetMock() {
    this._mockHandler = null;
  }
}

const defaultPrivacyScannerClient = new PrivacyScannerClient();

module.exports = {
  PrivacyScannerClient,
  privacyScannerClient: defaultPrivacyScannerClient
};
