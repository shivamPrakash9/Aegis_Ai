// Google Gemini Provider Adapter (Native Gemini REST API v1beta)

const { BaseProvider } = require('./provider.interface');
const { env } = require('../config/env');
const { safeFetch } = require('../utils/httpSecurity');
const {
  BadGatewayError,
  RateLimitError,
  GatewayTimeoutError,
  ServiceUnavailableError,
  BadRequestError
} = require('../utils/errors');
const { logger } = require('../utils/logger');

class GeminiProvider extends BaseProvider {
  constructor({
    id = 'gemini',
    name = 'Google Gemini',
    apiKey = process.env.GEMINI_API_KEY || '',
    baseUrl = 'https://generativelanguage.googleapis.com/v1beta'
  } = {}) {
    super(id, name);
    this.apiKey = apiKey;
    this.baseUrl = (baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
  }

  isConfigured() {
    return Boolean(this.apiKey && this.apiKey.length > 0);
  }

  normalizeRequest({ model, messages, temperature, maxTokens, stop }) {
    const contents = [];
    let systemInstruction = null;

    for (const m of messages) {
      const role = String(m.role || 'user').toLowerCase();
      const content = String(m.content || '');

      if (role === 'system') {
        systemInstruction = {
          parts: [{ text: content }]
        };
      } else if (role === 'assistant') {
        contents.push({
          role: 'model',
          parts: [{ text: content }]
        });
      } else {
        contents.push({
          role: 'user',
          parts: [{ text: content }]
        });
      }
    }

    if (contents.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: '' }]
      });
    }

    const generationConfig = {};
    if (typeof temperature === 'number') {
      generationConfig.temperature = Math.max(0, Math.min(2, temperature));
    }
    if (typeof maxTokens === 'number' && maxTokens > 0) {
      generationConfig.maxOutputTokens = Math.min(env.maxTokensLimit, maxTokens);
    }
    if (stop) {
      generationConfig.stopSequences = Array.isArray(stop) ? stop : [String(stop)];
    }

    const payload = { contents };
    if (Object.keys(generationConfig).length > 0) {
      payload.generationConfig = generationConfig;
    }
    if (systemInstruction) {
      payload.systemInstruction = systemInstruction;
    }

    return payload;
  }

  normalizeResponse(raw, requestedModel) {
    if (!raw || typeof raw !== 'object') {
      throw new BadGatewayError('Google Gemini provider returned empty or non-object response.');
    }

    // Check prompt feedback blocks
    if (raw.promptFeedback?.blockReason) {
      throw new BadGatewayError(
        `Gemini request was blocked by safety policy: ${raw.promptFeedback.blockReason}`
      );
    }

    const candidates = Array.isArray(raw.candidates) ? raw.candidates : [];
    if (candidates.length === 0) {
      throw new BadGatewayError('Google Gemini response contained no candidates.');
    }

    const candidate = candidates[0];
    const parts = candidate.content?.parts || [];
    const textContent = parts.map((p) => p.text || '').join('');
    const finishReason = candidate.finishReason || 'STOP';

    const promptTokens = raw.usageMetadata?.promptTokenCount ?? 0;
    const completionTokens = raw.usageMetadata?.candidatesTokenCount ?? 0;
    const totalTokens = raw.usageMetadata?.totalTokenCount ?? (promptTokens + completionTokens);

    return {
      id: `gemini_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: requestedModel,
      provider: this.id,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: textContent
          },
          finish_reason: finishReason.toLowerCase()
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
      if (env.nodeEnv !== 'production' && !env.isTest) {
        logger.warn(
          { correlationId, provider: this.name },
          'No Gemini API credentials configured; gracefully falling back to mock provider in non-production.'
        );
        const { mockProvider } = require('./mock.provider');
        return mockProvider.invokeCompletion({
          model,
          messages,
          temperature,
          maxTokens,
          correlationId
        });
      }
      throw new ServiceUnavailableError('Google Gemini provider API key is not configured.');
    }

    // Clean model identifier (strip 'models/' prefix if present)
    const cleanModel = String(model).replace(/^models\//, '');
    const endpoint = `${this.baseUrl}/models/${cleanModel}:generateContent`;
    const payload = this.normalizeRequest({ model: cleanModel, messages, temperature, maxTokens, stop });

    const startTime = Date.now();
    let response;

    try {
      response = await safeFetch(
        endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey
          },
          body: JSON.stringify(payload),
          timeoutMs: env.providerTimeoutMs
        },
        correlationId
      );
    } catch (err) {
      if (err instanceof GatewayTimeoutError) throw err;
      throw new BadGatewayError(`Failed to connect to Google Gemini API: ${err.message}`);
    }

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      let errBody = {};
      try {
        errBody = await response.json();
      } catch {
        errBody = { message: response.statusText };
      }

      const errMsg = errBody.error?.message || errBody.message || response.statusText;

      logger.error(
        {
          correlationId,
          status: response.status,
          latencyMs,
          err: errMsg
        },
        'Google Gemini request failed'
      );

      if (response.status === 401 || response.status === 403) {
        if (env.nodeEnv !== 'production') {
          logger.warn(
            { correlationId, provider: this.name, error: errMsg },
            'Upstream Gemini credentials rejected; falling back to mock provider in non-production.'
          );
          const { mockProvider } = require('./mock.provider');
          return mockProvider.invokeCompletion({
            model,
            messages,
            temperature,
            maxTokens,
            correlationId
          });
        }
        throw new BadGatewayError(`Gemini provider request rejected (${response.status}): ${errMsg}`);
      }

      if (response.status === 429) {
        throw new RateLimitError(`Gemini quota or rate limit exceeded: ${errMsg}`);
      }

      if (response.status >= 500) {
        throw new BadGatewayError(`Google Gemini server error (${response.status}): ${errMsg}`);
      }

      throw new BadGatewayError(`Google Gemini API error (${response.status}): ${errMsg}`);
    }

    const rawData = await response.json();
    return this.normalizeResponse(rawData, model);
  }

  async testConnection() {
    if (!this.isConfigured()) {
      return {
        healthy: false,
        latencyMs: 0,
        message: 'Google Gemini API key is not configured.'
      };
    }

    const startTime = Date.now();
    try {
      const endpoint = `${this.baseUrl}/models`;
      const res = await safeFetch(
        endpoint,
        {
          method: 'GET',
          headers: {
            'x-goog-api-key': this.apiKey
          },
          timeoutMs: 8000
        },
        'conn_test_gemini'
      );

      const latencyMs = Date.now() - startTime;
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const count = Array.isArray(data.models) ? data.models.length : 0;
        return {
          healthy: true,
          latencyMs,
          message: `Gemini API connected successfully (${count} models available). Verified in ${latencyMs}ms.`
        };
      }

      const errData = await res.json().catch(() => ({}));
      const msg = errData.error?.message || res.statusText || 'Unknown error';
      return {
        healthy: false,
        latencyMs,
        message: `Gemini API authentication failed (HTTP ${res.status}): ${msg}`
      };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        message: `Connection to Gemini failed: ${err.message}`
      };
    }
  }
}

module.exports = {
  GeminiProvider,
  geminiProvider: new GeminiProvider()
};
