// OpenAI-Compatible Provider Adapter

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

class OpenAiCompatibleProvider extends BaseProvider {
  constructor({
    id = 'openai',
    name = 'OpenAI Compatible Provider',
    apiKey = env.openaiApiKey,
    baseUrl = env.openaiBaseUrl
  } = {}) {
    super(id, name);
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  isConfigured() {
    return Boolean(this.apiKey && this.apiKey.length > 0);
  }

  normalizeRequest({ model, messages, temperature, maxTokens, stop }) {
    const payload = {
      model,
      messages: messages.map((m) => ({
        role: m.role || 'user',
        content: m.content || ''
      }))
    };

    if (typeof temperature === 'number') {
      payload.temperature = Math.max(0, Math.min(2, temperature));
    }
    if (typeof maxTokens === 'number' && maxTokens > 0) {
      payload.max_tokens = Math.min(env.maxTokensLimit, maxTokens);
    }
    if (stop) {
      payload.stop = stop;
    }

    return payload;
  }

  normalizeResponse(raw, requestedModel) {
    if (!raw || typeof raw !== 'object') {
      throw new BadGatewayError('OpenAI provider returned empty or non-object response.');
    }

    const rawChoices = Array.isArray(raw.choices) ? raw.choices : [];
    if (rawChoices.length === 0) {
      throw new BadGatewayError('OpenAI provider response missing choices array.');
    }

    const promptTokens = raw.usage?.prompt_tokens ?? 0;
    const completionTokens = raw.usage?.completion_tokens ?? 0;
    const totalTokens = raw.usage?.total_tokens ?? (promptTokens + completionTokens);

    return {
      id: raw.id || `chatcmpl_${Date.now()}`,
      object: 'chat.completion',
      created: raw.created || Math.floor(Date.now() / 1000),
      model: raw.model || requestedModel,
      provider: this.id,
      choices: rawChoices.map((c, index) => ({
        index: c.index ?? index,
        message: {
          role: c.message?.role || 'assistant',
          content: c.message?.content || ''
        },
        finish_reason: c.finish_reason || 'stop'
      })),
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

    const endpoint = `${this.baseUrl}/chat/completions`;
    const payload = this.normalizeRequest({ model, messages, temperature, maxTokens, stop });

    let response;
    try {
      response = await safeFetch(
        endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`
          },
          body: JSON.stringify(payload),
          timeoutMs: env.providerTimeoutMs
        },
        correlationId
      );
    } catch (err) {
      if (err instanceof GatewayTimeoutError) throw err;
      throw new BadGatewayError(`Failed to reach OpenAI provider: ${err.message}`);
    }

    if (!response.ok) {
      let errBody = {};
      try {
        errBody = await response.json();
      } catch {
        // ignore
      }

      const errorMessage =
        errBody?.error?.message || `OpenAI provider returned HTTP status ${response.status}`;

      logger.error(
        { correlationId, status: response.status, provider: this.id },
        'OpenAI provider returned error response'
      );

      if (response.status === 429) {
        throw new RateLimitError(`OpenAI provider rate limit exceeded: ${errorMessage}`);
      }
      if (response.status === 504 || response.status === 408) {
        throw new GatewayTimeoutError(`OpenAI provider gateway timeout: ${errorMessage}`);
      }
      if (response.status >= 500) {
        throw new BadGatewayError(`OpenAI provider service error: ${errorMessage}`);
      }

      throw new BadGatewayError(`OpenAI provider request rejected (${response.status}): ${errorMessage}`);
    }

    let data;
    try {
      data = await response.json();
    } catch (parseErr) {
      throw new BadGatewayError('Malformed JSON returned by OpenAI provider.');
    }

    return this.normalizeResponse(data, model);
  }
}

module.exports = {
  OpenAiCompatibleProvider,
  openAiCompatibleProvider: new OpenAiCompatibleProvider()
};
