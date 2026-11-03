// Base Provider Interface

class BaseProvider {
  constructor(id, name) {
    this.id = id;
    this.name = name;
  }

  isConfigured() {
    throw new Error('isConfigured() must be implemented by provider subclass');
  }

  /**
   * Invokes completion against provider.
   *
   * @param {object} params
   * @param {string} params.model
   * @param {Array<{role: string, content: string}>} params.messages
   * @param {number} [params.temperature]
   * @param {number} [params.maxTokens]
   * @param {string} [params.correlationId]
   * @param {string} [params.traceId]
   * @returns {Promise<{
   *   id: string,
   *   object: string,
   *   created: number,
   *   model: string,
   *   provider: string,
   *   choices: Array<{index: number, message: {role: string, content: string}, finish_reason: string}>,
   *   usage: {promptTokens: number, completionTokens: number, totalTokens: number, prompt_tokens: number, completion_tokens: number, total_tokens: number}
   * }>}
   */
  async invokeCompletion(params) {
    throw new Error('invokeCompletion() must be implemented by provider subclass');
  }

  normalizeRequest(params) {
    throw new Error('normalizeRequest() must be implemented by provider subclass');
  }

  normalizeResponse(raw, requestedModel) {
    throw new Error('normalizeResponse() must be implemented by provider subclass');
  }
}

module.exports = { BaseProvider };
