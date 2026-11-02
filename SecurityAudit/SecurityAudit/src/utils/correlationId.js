// Correlation, Trace, and Event Identifier Utilities

const crypto = require('crypto');

function generateCorrelationId() {
  return `corr_${crypto.randomBytes(8).toString('hex')}`;
}

function generateTraceId() {
  return `trace_${crypto.randomBytes(8).toString('hex')}`;
}

function generateEventId() {
  return `evt_${crypto.randomBytes(8).toString('hex')}`;
}

module.exports = {
  generateCorrelationId,
  generateTraceId,
  generateEventId
};
