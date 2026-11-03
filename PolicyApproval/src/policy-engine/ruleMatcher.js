// Rule Validation and Matching Engine

const { evaluateCondition } = require('./conditionEvaluator');
const { BadRequestError } = require('../utils/errors');

const VALID_EFFECTS = new Set(['DENY', 'REQUIRE_APPROVAL', 'ALLOW']);

/**
 * Validates a single policy rule definition.
 * @param {object} rule
 */
function validateRule(rule) {
  if (!rule || typeof rule !== 'object') {
    throw new BadRequestError('Rule must be an object.');
  }

  if (!rule.id || typeof rule.id !== 'string') {
    throw new BadRequestError('Rule must have a string id.');
  }

  if (!rule.effect || !VALID_EFFECTS.has(rule.effect.toUpperCase())) {
    throw new BadRequestError(
      `Rule '${rule.id}' must specify an effect of 'DENY', 'REQUIRE_APPROVAL', or 'ALLOW'.`
    );
  }

  if (!rule.reason || typeof rule.reason !== 'string') {
    throw new BadRequestError(`Rule '${rule.id}' must specify a reason string.`);
  }

  if (!rule.condition || typeof rule.condition !== 'object') {
    throw new BadRequestError(`Rule '${rule.id}' must define a valid condition object.`);
  }

  if (Object.keys(rule.condition).length === 0) {
    throw new BadRequestError(`Rule '${rule.id}' condition cannot be empty.`);
  }

  if (rule.requiredApprovers && !Array.isArray(rule.requiredApprovers)) {
    throw new BadRequestError(`Rule '${rule.id}' requiredApprovers must be an array of strings.`);
  }
}

/**
 * Matches a list of rules against the request evaluation context.
 *
 * @param {Array<object>} rules
 * @param {object} context
 * @returns {Array<{
 *   id: string,
 *   ruleId: string,
 *   name: string,
 *   effect: 'DENY' | 'REQUIRE_APPROVAL' | 'ALLOW',
 *   priority: number,
 *   reason: string,
 *   reasonCode?: string,
 *   requiredApprovers: Array<string>
 * }>}
 */
function matchRules(rules, context) {
  if (!Array.isArray(rules)) return [];

  const sortedRules = rules.slice().sort((a, b) => (a.priority || 100) - (b.priority || 100));
  const matched = [];

  for (const rule of sortedRules) {
    if (rule.enabled === false) {
      continue;
    }

    validateRule(rule);

    const isMatch = evaluateCondition(rule.condition, context);

    if (isMatch) {
      matched.push({
        id: rule.id,
        ruleId: rule.id,
        name: rule.name || rule.id,
        effect: rule.effect.toUpperCase(),
        priority: typeof rule.priority === 'number' ? rule.priority : 100,
        reason: rule.reason || `Rule '${rule.name || rule.id}' matched.`,
        reasonCode: rule.reasonCode || undefined,
        requiredApprovers: rule.requiredApprovers || []
      });
    }
  }

  return matched;
}

module.exports = {
  validateRule,
  matchRules,
  VALID_EFFECTS
};
