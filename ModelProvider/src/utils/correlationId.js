// Correlation and Operational Identifier Generators

const crypto = require('crypto');

function generateCorrelationId() {
  return `corr_${crypto.randomBytes(8).toString('hex')}`;
}

function generateTraceId() {
  return `trace_${crypto.randomBytes(12).toString('hex')}`;
}

function generateCompletionId() {
  return `chatcmpl_${crypto.randomBytes(12).toString('hex')}`;
}

function generateUsageId() {
  return `usage_${crypto.randomBytes(8).toString('hex')}`;
}

function generateModelConfigId() {
  return `mcfg_${crypto.randomBytes(8).toString('hex')}`;
}

module.exports = {
  generateCorrelationId,
  generateTraceId,
  generateCompletionId,
  generateUsageId,
  generateModelConfigId
};
