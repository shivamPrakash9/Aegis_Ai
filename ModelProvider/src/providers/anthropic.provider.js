// Anthropic Claude Messages API Provider Adapter

const { BaseProvider } = require('./provider.interface');
const { env } = require('../config/env');
const { safeFetch } = require('../utils/httpSecurity');
const {
  BadGatewayError,
  RateLimitError,
  GatewayTimeoutError,
  ServiceUnavailableError
} = require('../utils/errors');
const { logger } = require('../utils/logger');

class AnthropicProvider extends BaseProvider {
  constructor({
    id = 'anthropic',
    name = 'Anthropic Claude Provider',
    apiKey = env.anthropicApiKey,
    baseUrl = env.anthropicBaseUrl
  } = {}) {
    super(id, name);
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  isConfigured() {
    return Boolean(this.apiKey && this.apiKey.length > 0);
  }

  normalizeRequest({ model, messages, temperature, maxTokens, stop }) {
    let systemPrompt = '';
    const anthropicMessages = [];

    for (const m of messages) {
      if (m.role === 'system') {
        systemPrompt = systemPrompt ? `${systemPrompt}\n${m.content}` : m.content;
      } else {
        anthropicMessages.push({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content || ''
        });
      }
    }

    // Anthropic requires at least 1 message
    if (anthropicMessages.length === 0) {
      anthropicMessages.push({ role: 'user', content: 'Hello' });
    }

    const payload = {
      model,
      messages: anthropicMessages,
      max_tokens: maxTokens && maxTokens > 0 ? Math.min(env.maxTokensLimit, maxTokens) : 4096
    };

    if (systemPrompt) {
      payload.system = systemPrompt;
    }

    if (typeof temperature === 'number') {
      // Anthropic temperature is 0.0 to 1.0
      payload.temperature = Math.max(0, Math.min(1, temperature));
    }

    if (Array.isArray(stop) && stop.length > 0) {
      payload.stop_sequences = stop;
    }

    return payload;
  }

  normalizeResponse(raw, requestedModel) {
    if (!raw || typeof raw !== 'object') {
      throw new BadGatewayError('Anthropic provider returned empty or non-object response.');
    }

    let textContent = '';
    if (Array.isArray(raw.content)) {
      textContent = raw.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('');
    } else if (typeof raw.content === 'string') {
      textContent = raw.content;
    }

    const promptTokens = raw.usage?.input_tokens ?? 0;
    const completionTokens = raw.usage?.output_tokens ?? 0;
    const totalTokens = promptTokens + completionTokens;

    return {
      id: raw.id || `msg_${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: raw.model || requestedModel,
      provider: this.id,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: textContent
          },
          finish_reason: raw.stop_reason === 'end_turn' ? 'stop' : raw.stop_reason || 'stop'
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

  async invokeCompletion({
    model,
    messages,
    temperature,
    maxTokens,
    stop,
    correlationId = 'unknown'
  }) {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableError(
        `Provider '${this.id}' is not configured with valid API credentials.`
      );
    }

    const endpoint = `${this.baseUrl}/v1/messages`;
    const payload = this.normalizeRequest({ model, messages, temperature, maxTokens, stop });

    let response;
    try {
      response = await safeFetch(
        endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify(payload),
          timeoutMs: env.providerTimeoutMs
        },
        correlationId
      );
    } catch (err) {
      if (err instanceof GatewayTimeoutError) throw err;
      throw new BadGatewayError(`Failed to reach Anthropic provider: ${err.message}`);
    }

    if (!response.ok) {
      let errBody = {};
      try {
        errBody = await response.json();
      } catch {
        // ignore
      }

      const errorMessage =
        errBody?.error?.message || `Anthropic provider returned HTTP status ${response.status}`;

      logger.error(
        { correlationId, status: response.status, provider: this.id },
        'Anthropic provider returned error response'
      );

      if (response.status === 429) {
        throw new RateLimitError(`Anthropic rate limit exceeded: ${errorMessage}`);
      }
      if (response.status === 504 || response.status === 408) {
        throw new GatewayTimeoutError(`Anthropic gateway timeout: ${errorMessage}`);
      }
      if (response.status >= 500) {
        throw new BadGatewayError(`Anthropic provider service error: ${errorMessage}`);
      }

      throw new BadGatewayError(`Anthropic request rejected (${response.status}): ${errorMessage}`);
    }

    let data;
    try {
      data = await response.json();
    } catch (parseErr) {
      throw new BadGatewayError('Malformed JSON returned by Anthropic provider.');
    }

    return this.normalizeResponse(data, model);
  }
}

module.exports = {
  AnthropicProvider,
  anthropicProvider: new AnthropicProvider()
};
