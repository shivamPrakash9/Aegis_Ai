// Sensitive Data Sanitization Service for Security & Audit Events

const { env } = require('../config/env');

const SENSITIVE_KEY_PATTERNS = [
  /^prompt$/i,
  /^prompts$/i,
  /^raw_?prompt$/i,
  /^user_?prompt$/i,
  /^completion$/i,
  /^completions$/i,
  /^raw_?completion$/i,
  /^assistant_?response$/i,
  /^password$/i,
  /^passwords$/i,
  /^api_?key$/i,
  /^(auth_?|access_?|refresh_?|bearer_?|session_?|jwt_?|id_?)?token$/i,
  /^authorization$/i,
  /^auth_?header$/i,
  /^cookie$/i,
  /^cookies$/i,
  /^secret$/i,
  /^secrets$/i,
  /^private_?key$/i,
  /^ssn$/i,
  /^credit_?card$/i,
  /^database_?url$/i,
  /^connection_?string$/i
];

const MAX_STRING_LENGTH = 2000;
const MAX_ARRAY_LENGTH = 50;

class EventSanitizationService {
  /**
   * Checks if a field name matches any known sensitive patterns.
   * Numeric values (such as LLM token usage counts) are preserved.
   *
   * @param {string} key
   * @param {*} [value]
   * @returns {boolean}
   */
  isSensitiveKey(key, value) {
    if (typeof key !== 'string') return false;

    // Numbers are never secret credentials (e.g. tokens: 88, totalTokens: 120, latencyMs: 50)
    if (typeof value === 'number') {
      return false;
    }

    // Explicitly allow LLM usage token counts if not string credential
    if (/^(prompt_?|completion_?|total_?)?tokens?$/i.test(key) && typeof value !== 'string') {
      return false;
    }

    return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
  }

  /**
   * Sanitizes arbitrary string content (scrubbing tokens/secrets in error messages).
   *
   * @param {string} str
   * @returns {string}
   */
  sanitizeString(str) {
    if (typeof str !== 'string') return str;

    let sanitized = str
      .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
      .replace(/(password|apiKey|token|secret)\s*[:=]\s*['"]?[^'"\s,;]+['"]?/gi, '$1=[REDACTED]');

    if (sanitized.length > MAX_STRING_LENGTH) {
      sanitized = `${sanitized.slice(0, MAX_STRING_LENGTH)}...[TRUNCATED]`;
    }

    return sanitized;
  }

  /**
   * Recursively sanitizes object metadata up to max depth, stripping or redacting sensitive keys.
   *
   * @param {*} value
   * @param {number} [depth=0]
   * @returns {*}
   */
  sanitizeMetadata(value, depth = 0) {
    if (depth > env.maxMetadataDepth) {
      return '[TRUNCATED_DEPTH_EXCEEDED]';
    }

    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    if (Array.isArray(value)) {
      const items = value.slice(0, MAX_ARRAY_LENGTH);
      return items.map((item) => this.sanitizeMetadata(item, depth + 1));
    }

    if (typeof value === 'object') {
      const sanitizedObj = {};
      const entries = Object.entries(value);

      for (const [k, v] of entries) {
        // Prevent prototype pollution
        if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
          continue;
        }

        if (this.isSensitiveKey(k, v)) {
          sanitizedObj[k] = '[REDACTED_SENSITIVE_DATA]';
        } else {
          sanitizedObj[k] = this.sanitizeMetadata(v, depth + 1);
        }
      }

      return sanitizedObj;
    }

    return String(value);
  }

  /**
   * Main entrypoint for sanitizing an entire audit event payload before storage.
   *
   * @param {object} event
   * @returns {object} Sanitized event copy
   */
  sanitizeEvent(event) {
    const sanitized = { ...event };

    // Standard metadata or details container
    if (sanitized.details) {
      sanitized.details = this.sanitizeMetadata(sanitized.details);
    }
    if (sanitized.metadata) {
      sanitized.metadata = this.sanitizeMetadata(sanitized.metadata);
    }

    // Ensure error messages are scrubbed
    if (sanitized.errorMessage && typeof sanitized.errorMessage === 'string') {
      sanitized.errorMessage = this.sanitizeString(sanitized.errorMessage);
    }

    return sanitized;
  }
}

const eventSanitizationService = new EventSanitizationService();

module.exports = {
  EventSanitizationService,
  eventSanitizationService
};
