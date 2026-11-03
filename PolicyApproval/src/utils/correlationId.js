// Identifiers and Correlation Utilities

const crypto = require('crypto');

function generateEvaluationId() {
  return `eval_${crypto.randomBytes(8).toString('hex')}`;
}

function generateApprovalId() {
  return `appr_${crypto.randomBytes(8).toString('hex')}`;
}

function generatePolicyId() {
  return `pol_${crypto.randomBytes(8).toString('hex')}`;
}

function generateCorrelationId() {
  return `corr_${crypto.randomBytes(8).toString('hex')}`;
}

module.exports = {
  generateEvaluationId,
  generateApprovalId,
  generatePolicyId,
  generateCorrelationId
};
