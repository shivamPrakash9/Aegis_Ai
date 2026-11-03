// Correlation and Scan Identifier Utilities

const crypto = require('crypto');

function generateScanId() {
  const randomHex = crypto.randomBytes(8).toString('hex');
  return `scan_${randomHex}`;
}

function generateCorrelationId() {
  const randomHex = crypto.randomBytes(8).toString('hex');
  return `corr_${randomHex}`;
}

function generateRequestId() {
  const randomHex = crypto.randomBytes(8).toString('hex');
  return `req_${randomHex}`;
}

module.exports = {
  generateScanId,
  generateCorrelationId,
  generateRequestId
};
