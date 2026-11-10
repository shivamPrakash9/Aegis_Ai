// Google Gemini Provider Adapter for AegisAI

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

class GeminiProvider extends BaseProvider {
  constructor({
    id = 'gemini',
    name = 'Google Gemini Provider',
    apiKey = env.geminiApiKey,
    baseUrl = env.geminiBaseUrl,
    defaultModel = env.geminiModel
  } = {}) {
    super(id, name);
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.defaultModel = defaultModel || 'gemini-3.5-flash-lite';
  }

  isConfigured() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Normalizes inbound messages and parameters into the Google Gemini contents & generationConfig format.
   *
   * @param {object} params
   * @param {string} params.model
   * @param {Array<{role: string, content: string}>} params.messages
   * @param {number} [params.temperature]
   * @param {number} [params.maxTokens]
   * @param {string|string[]} [params.stop]
   * @returns {object} Gemini request payload
   */
  normalizeRequest({ messages = [], temperature, maxTokens, stop }) {
    let systemText = '';
    const nonSystemMessages = [];

    for (const m of messages) {
      if (!m) continue;
      const role = (m.role || '').toLowerCase();
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content || '');

      if (role === 'system' || role === 'developer') {
        systemText = systemText ? `${systemText}\n${content}` : content;
      } else {
        nonSystemMessages.push({
          role: role === 'assistant' ? 'model' : 'user',
          text: content
        });
      }
    }

    // Gemini requires alternating user/model roles. Merge consecutive messages with the same role.
    const contents = [];
    for (const item of nonSystemMessages) {
      if (contents.length > 0 && contents[contents.length - 1].role === item.role) {
        contents[contents.length - 1].parts.push({ text: item.text });
      } else {
        contents.push({
          role: item.role,
          parts: [{ text: item.text }]
        });
      }
    }

    // Gemini requires at least one content part
    if (contents.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: 'Hello' }]
      });
    }

    const payload = { contents };

    if (systemText.trim().length > 0) {
      payload.systemInstruction = {
        parts: [{ text: systemText }]
      };
    }

    const generationConfig = {};
    if (typeof temperature === 'number') {
      generationConfig.temperature = Math.max(0, Math.min(2, temperature));
    }
    if (typeof maxTokens === 'number' && maxTokens > 0) {
      generationConfig.maxOutputTokens = Math.min(env.maxTokensLimit, maxTokens);
    }
    if (Array.isArray(stop) && stop.length > 0) {
      generationConfig.stopSequences = stop;
    } else if (typeof stop === 'string' && stop.trim().length > 0) {
      generationConfig.stopSequences = [stop];
    }

    if (Object.keys(generationConfig).length > 0) {
      payload.generationConfig = generationConfig;
    }

    return payload;
  }

  /**
   * Normalizes Google Gemini generateContent response into OpenAI/Aegis canonical format.
   *
   * @param {object} raw Gemini API response
   * @param {string} requestedModel
   * @returns {object} Canonical completion response
   */
  normalizeResponse(raw, requestedModel) {
    if (!raw || typeof raw !== 'object') {
      throw new BadGatewayError('Gemini provider returned empty or non-object response.');
    }

    const candidate = Array.isArray(raw.candidates) && raw.candidates.length > 0
      ? raw.candidates[0]
      : null;

    let textContent = '';
    if (candidate && candidate.content && Array.isArray(candidate.content.parts)) {
      textContent = candidate.content.parts
        .map((p) => (p && typeof p.text === 'string' ? p.text : ''))
        .join('');
    }

    let finishReason = 'stop';
    if (candidate && candidate.finishReason) {
      const reason = String(candidate.finishReason).toLowerCase();
      if (reason === 'max_tokens') {
        finishReason = 'length';
      } else if (reason === 'safety' || reason === 'recitation') {
        finishReason = 'content_filter';
      } else {
        finishReason = 'stop';
      }
    }

    const promptTokens = raw.usageMetadata?.promptTokenCount ?? 0;
    const completionTokens = raw.usageMetadata?.candidatesTokenCount ?? 0;
    const totalTokens = raw.usageMetadata?.totalTokenCount ?? (promptTokens + completionTokens);

    return {
      id: `chatcmpl_gemini_${Date.now()}`,
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
          finish_reason: finishReason
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

  /**
   * Invokes Gemini model completion via Google Generative Language API.
   *
   * @param {object} params
   * @param {string} params.model
   * @param {Array<{role: string, content: string}>} params.messages
   * @param {number} [params.temperature]
   * @param {number} [params.maxTokens]
   * @param {string|string[]} [params.stop]
   * @param {string} [params.correlationId]
   * @param {string} [params.traceId]
   * @returns {Promise<object>} Canonical completion object
   */
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
        `Provider '${this.id}' is not configured with valid API credentials. Please set GEMINI_API_KEY.`
      );
    }

    // Resolve model name
    let effectiveModel = model || this.defaultModel || 'gemini-3.5-flash-lite';
    if (effectiveModel === 'gemini') {
      effectiveModel = this.defaultModel || 'gemini-3.5-flash-lite';
    }

    const endpoint = `${this.baseUrl}/v1beta/models/${encodeURIComponent(effectiveModel)}:generateContent`;
    const payload = this.normalizeRequest({ messages, temperature, maxTokens, stop });

    const maxRetries = 2;
    let attempt = 0;
    let lastError = null;

    while (attempt <= maxRetries) {
      attempt++;
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
        throw new BadGatewayError(`Failed to reach Gemini provider: ${err.message}`);
      }

      if (!response.ok) {
        let errBody = {};
        try {
          errBody = await response.json();
        } catch {
          // ignore
        }

        const rawMessage =
          errBody?.error?.message || `Gemini provider returned HTTP status ${response.status}`;

        // Sanitize message to never leak secrets
        const sanitizedMessage = rawMessage.replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]');

        logger.error(
          { correlationId, status: response.status, provider: this.id, attempt },
          'Gemini provider returned error response'
        );

        // Retry transient errors (429 Rate Limit, 503 Overloaded)
        if ((response.status === 429 || response.status === 503) && attempt <= maxRetries) {
          const delayMs = attempt * 1200;
          logger.warn(
            { correlationId, status: response.status, attempt, delayMs },
            'Retrying transient Gemini API rate limit / service overload'
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        if (response.status === 429) {
          throw new RateLimitError(`Gemini provider rate limit exceeded: ${sanitizedMessage}`);
        }
        if (response.status === 504 || response.status === 408) {
          throw new GatewayTimeoutError(`Gemini provider gateway timeout: ${sanitizedMessage}`);
        }
        if (response.status >= 500) {
          throw new BadGatewayError(`Gemini provider service error: ${sanitizedMessage}`);
        }

        throw new BadGatewayError(
          `Gemini provider request rejected (${response.status}): ${sanitizedMessage}`
        );
      }

      let data;
      try {
        data = await response.json();
      } catch {
        throw new BadGatewayError('Malformed JSON returned by Gemini provider.');
      }

      return this.normalizeResponse(data, effectiveModel);
    }

    throw lastError || new BadGatewayError('Gemini provider request failed after retries.');
  }
}

module.exports = {
  GeminiProvider,
  geminiProvider: new GeminiProvider()
};

