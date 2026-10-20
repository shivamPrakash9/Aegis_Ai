// Safe AST-based Policy Condition Evaluator (Zero eval(), Zero dynamic JS)

const { BadRequestError } = require('../utils/errors');

const MAX_DEPTH = 5;

/**
 * Safely extracts field value from request context.
 * Prevents prototype pollution and arbitrary property navigation.
 *
 * @param {object} context
 * @param {string} fieldName
 * @returns {any}
 */
function extractFieldValue(context, fieldName) {
  if (!fieldName || typeof fieldName !== 'string') return undefined;

  // Disallow forbidden prototype/constructor property lookups
  if (fieldName.includes('__proto__') || fieldName.includes('constructor') || fieldName.includes('prototype')) {
    return undefined;
  }

  // Check top-level recognized context fields
  if (Object.prototype.hasOwnProperty.call(context, fieldName)) {
    return context[fieldName];
  }

  // Handle nested metadata fields e.g. "metadata.department"
  if (fieldName.startsWith('metadata.')) {
    const key = fieldName.slice(9);
    return context.metadata ? context.metadata[key] : undefined;
  }

  return undefined;
}

/**
 * Evaluates a single comparison between context value and rule target.
 *
 * @param {any} actual
 * @param {string} operator
 * @param {any} expected
 * @returns {boolean}
 */
function evaluateComparison(actual, operator, expected) {
  const op = String(operator || '').toLowerCase();

  switch (op) {
    case 'eq':
    case 'equals':
    case '==':
      return actual === expected;

    case 'neq':
    case 'not_equals':
    case '!=':
      return actual !== expected;

    case 'in':
      if (Array.isArray(expected)) {
        return expected.includes(actual);
      }
      return false;

    case 'not_in':
    case 'notin':
      if (Array.isArray(expected)) {
        return !expected.includes(actual);
      }
      return true;

    case 'contains':
      if (typeof actual === 'string') {
        return actual.includes(String(expected));
      }
      if (Array.isArray(actual)) {
        return actual.includes(expected);
      }
      return false;

    case 'not_contains':
    case 'notcontains':
      if (typeof actual === 'string') {
        return !actual.includes(String(expected));
      }
      if (Array.isArray(actual)) {
        return !actual.includes(expected);
      }
      return true;

    case 'starts_with':
    case 'startswith':
      if (typeof actual === 'string' && typeof expected === 'string') {
        return actual.startsWith(expected);
      }
      return false;

    case 'ends_with':
    case 'endswith':
      if (typeof actual === 'string' && typeof expected === 'string') {
        return actual.endsWith(expected);
      }
      return false;

    case 'gt':
    case '>':
      return typeof actual === 'number' && typeof expected === 'number' && actual > expected;

    case 'gte':
    case '>=':
      return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;

    case 'lt':
    case '<':
      return typeof actual === 'number' && typeof expected === 'number' && actual < expected;

    case 'lte':
    case '<=':
      return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;

    case 'exists': {
      const isPresent = actual !== undefined && actual !== null;
      return expected === false ? !isPresent : isPresent;
    }

    case 'not_exists':
    case 'notexists':
      return actual === undefined || actual === null;

    case 'has_role':
      if (actual === expected) return true;
      if (Array.isArray(actual) && actual.includes(expected)) return true;
      return false;

    case 'has_permission':
      if (Array.isArray(actual)) {
        return actual.includes(expected);
      }
      return false;

    default:
      return false; // Fail-closed on unsupported operator
  }
}

/**
 * Recursively evaluates structured conditions against request context.
 *
 * @param {object} condition
 * @param {object} context
 * @param {number} [depth=0]
 * @returns {boolean}
 */
function evaluateCondition(condition, context, depth = 0) {
  if (depth > MAX_DEPTH) {
    return false; // Bounded depth: fails closed
  }

  if (!condition || typeof condition !== 'object') {
    return true; // No conditions to evaluate, passes
  }

  if (Object.keys(condition).length === 0) {
    return true; // Empty condition evaluates to true
  }

  // Composite: ALL (AND)
  if (Array.isArray(condition.all) || Array.isArray(condition.AND)) {
    const list = condition.all || condition.AND;
    if (list.length === 0) return true;
    return list.every((child) => evaluateCondition(child, context, depth + 1));
  }

  // Composite: ANY (OR)
  if (Array.isArray(condition.any) || Array.isArray(condition.OR)) {
    const list = condition.any || condition.OR;
    if (list.length === 0) return false;
    return list.some((child) => evaluateCondition(child, context, depth + 1));
  }

  // Composite: NOT
  if (condition.not || condition.NOT) {
    const child = condition.not || condition.NOT;
    return !evaluateCondition(child, context, depth + 1);
  }

  // Leaf condition: field + operator + value
  if (condition.field && condition.operator) {
    const actualValue = extractFieldValue(context, condition.field);
    return evaluateComparison(actualValue, condition.operator, condition.value);
  }

  return false;
}

module.exports = {
  extractFieldValue,
  evaluateComparison,
  evaluateCondition
};
