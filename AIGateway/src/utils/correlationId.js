// Correlation ID and Trace ID Utilities

const { v4: uuidv4, validate: uuidValidate } = require('uuid');

/**
 * Validates or generates a correlation ID.
 * @param {string} [candidateId]
 * @returns {string}
 */
function getOrGenerateCorrelationId(candidateId) {
  if (candidateId && typeof candidateId === 'string') {
    const trimmed = candidateId.trim();
    // Allow valid UUID or alphanumeric with hyphens/underscores up to 64 chars
    if (trimmed.length > 0 && trimmed.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      return trimmed;
    }
  }
  return uuidv4();
}

/**
 * Generates a unique trace identifier for AI request lifecycle tracking.
 * @returns {string}
 */
function generateTraceId() {
  return `trace_${uuidv4().replace(/-/g, '')}`;
}

/**
 * Generates an internal AI request identifier.
 * @returns {string}
 */
function generateRequestId() {
  return `req_${uuidv4().replace(/-/g, '').slice(0, 24)}`;
}

module.exports = {
  getOrGenerateCorrelationId,
  generateTraceId,
  generateRequestId
};
