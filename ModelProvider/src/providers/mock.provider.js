// Deterministic Mock Provider for Offline Development & Automated Testing

const { BaseProvider } = require('./provider.interface');
const { generateCompletionId } = require('../utils/correlationId');
const { RateLimitError, BadGatewayError, GatewayTimeoutError } = require('../utils/errors');

class MockProvider extends BaseProvider {
  constructor() {
    super('mock', 'Deterministic Mock Provider');
    this.configured = true;
    this.customResponses = new Map();
    this.simulatedError = null;
    this.simulatedLatencyMs = 0;
    this.invocationCount = 0;
    this.lastInvokedMessages = [];
  }

  isConfigured() {
    return this.configured;
  }

  setMockResponse(model, text) {
    this.customResponses.set(model, text);
  }

  setSimulatedError(errorType) {
    this.simulatedError = errorType;
  }

  setSimulatedLatency(ms) {
    this.simulatedLatencyMs = ms;
  }

  reset() {
    this.customResponses.clear();
    this.simulatedError = null;
    this.simulatedLatencyMs = 0;
    this.invocationCount = 0;
    this.lastInvokedMessages = [];
  }

  normalizeRequest(params) {
    return {
      model: params.model,
      messages: params.messages,
      temperature: params.temperature,
      max_tokens: params.maxTokens
    };
  }

  normalizeResponse(raw, requestedModel) {
    return raw;
  }

  async invokeCompletion({ model, messages, temperature = 0.7, maxTokens = 1000, correlationId = 'unknown' }) {
    this.invocationCount++;
    this.lastInvokedMessages = Array.isArray(messages) ? JSON.parse(JSON.stringify(messages)) : [];

    if (this.simulatedLatencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.simulatedLatencyMs));
    }

    if (this.simulatedError === 'RATE_LIMIT') {
      throw new RateLimitError('Mock provider simulated rate limit (HTTP 429).');
    }
    if (this.simulatedError === 'TIMEOUT') {
      throw new GatewayTimeoutError('Mock provider simulated timeout (HTTP 504).');
    }
    if (this.simulatedError === 'PROVIDER_DOWN') {
      throw new BadGatewayError('Mock provider simulated upstream failure (HTTP 502).');
    }

    const lastMessage = Array.isArray(messages) && messages.length > 0
      ? messages[messages.length - 1].content
      : '';

    const responseContent = this.customResponses.get(model) ||
      `[Mock Assistant Response] Processed prompt for model '${model}'. Echo: ${String(lastMessage).slice(0, 50)}`;

    const promptTokens = Math.max(1, Math.round(String(lastMessage).length / 4));
    const completionTokens = Math.max(1, Math.round(responseContent.length / 4));
    const totalTokens = promptTokens + completionTokens;

    return {
      id: generateCompletionId(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      provider: 'mock',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: responseContent
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        promptTokens,
        completionTokens,
        totalTokens,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens
      }
    };
  }
}

module.exports = {
  MockProvider,
  mockProvider: new MockProvider()
};
