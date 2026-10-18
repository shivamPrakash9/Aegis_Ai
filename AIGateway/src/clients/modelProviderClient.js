// Model & Provider Service REST Client Integration

const { env } = require('../config/env');
const { ServiceUnavailableError, BadGatewayError, GatewayTimeoutError } = require('../utils/errors');
const { logger } = require('../utils/logger');

class ModelProviderClient {
  constructor(baseUrl = env.modelProviderUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this._mockHandler = null;
  }

  /**
   * Invokes the selected or routed AI model via Model & Provider Service.
   * Invoked strictly AFTER privacy scanning and policy approval.
   *
   * @param {object} params
   * @param {Array<{role: string, content: string}>} params.messages
   * @param {object} [params.modelPreference]
   * @param {object} [params.routingConstraints]
   * @param {string} params.organizationId
   * @param {string} params.traceId
   * @param {string} params.correlationId
   * @returns {Promise<{
   *   model: string,
   *   provider: string,
   *   choices: Array<{message: {role: string, content: string}}>,
   *   usage?: {promptTokens: number, completionTokens: number, totalTokens: number}
   * }>}
   */
  async invokeModel({ messages, modelPreference, routingConstraints, organizationId, traceId, correlationId }) {
    if (this._mockHandler) {
      return this._mockHandler({ messages, modelPreference, routingConstraints, organizationId, traceId, correlationId });
    }

    const url = `${this.baseUrl}/v1/chat/completions`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), env.requestTimeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-Id': correlationId || 'unknown',
          'X-Trace-Id': traceId || 'unknown'
        },
        body: JSON.stringify({
          messages,
          modelPreference: modelPreference || {},
          routingConstraints: routingConstraints || {},
          organizationId
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.status === 504) {
        throw new GatewayTimeoutError('Model & Provider Service timed out while waiting for provider completion.');
      }

      if (!response.ok) {
        throw new BadGatewayError(
          `Model & Provider Service returned HTTP status ${response.status}.`
        );
      }

      const data = await response.json();

      if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        throw new BadGatewayError('Model & Provider Service returned an invalid or empty choices response.');
      }

      return data;
    } catch (err) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        throw new GatewayTimeoutError('Model invocation timed out.');
      }

      if (err instanceof GatewayTimeoutError || err instanceof BadGatewayError) {
        throw err;
      }

      logger.error(
        { correlationId, err: err.message, service: 'ModelProvider' },
        'Downstream failure during model invocation'
      );

      throw new ServiceUnavailableError(
        'Model & Provider Service is currently unreachable.'
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

const defaultModelProviderClient = new ModelProviderClient();

module.exports = {
  ModelProviderClient,
  modelProviderClient: defaultModelProviderClient
};
