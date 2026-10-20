// Regular Expression Safety & ReDoS Protection Utilities

const { BadRequestError } = require('./errors');

const MAX_PATTERN_LENGTH = 300;
const MAX_MATCH_EXECUTION_TIME_MS = 100;
const MAX_MATCHES_PER_STRING = 500;

// Patterns that commonly indicate catastrophic backtracking (ReDoS)
const REDOS_PATTERNS = [
  /(\+|\*|\{[0-9]+,?[0-9]*\})\s*(\+|\*|\{[0-9]+,?[0-9]*\})/, // Nested or adjacent unbounded quantifiers
  /\([^)]*(\+|\*)[^)]*\)\s*(\+|\*|\{[0-9]+,?[0-9]*\})/,        // Group with quantifier followed by another quantifier: (a+)+
  /\([a-zA-Z0-9_|.\\]*\|[a-zA-Z0-9_|.\\]*\)\s*(\+|\*)/        // Ambiguous overlapping alternation with quantifier
];

/**
 * Validates a custom regular expression pattern for length, syntax, and potential ReDoS vulnerabilities.
 * @param {string} patternStr
 * @param {string} [flags='gi']
 * @returns {RegExp}
 */
function validateSafeRegex(patternStr, flags = 'gi') {
  if (!patternStr || typeof patternStr !== 'string') {
    throw new BadRequestError('Custom pattern must be a non-empty string.');
  }

  if (patternStr.length > MAX_PATTERN_LENGTH) {
    throw new BadRequestError(
      `Custom pattern exceeds maximum allowed length of ${MAX_PATTERN_LENGTH} characters.`
    );
  }

  // Check for known ReDoS vulnerabilities
  for (const redosTest of REDOS_PATTERNS) {
    if (redosTest.test(patternStr)) {
      throw new BadRequestError(
        'Pattern rejected: Detected unsafe nested or overlapping quantifiers susceptible to catastrophic backtracking (ReDoS).'
      );
    }
  }

  try {
    return new RegExp(patternStr, flags);
  } catch (err) {
    throw new BadRequestError(`Invalid regular expression syntax: ${err.message}`);
  }
}

/**
 * Safely executes a regular expression match across a string with loop and execution time guards.
 *
 * @param {RegExp} regex
 * @param {string} text
 * @param {number} [maxMatches=500]
 * @returns {Array<{ match: string, index: number, length: number }>}
 */
function safeExecAll(regex, text, maxMatches = MAX_MATCHES_PER_STRING) {
  if (!text || typeof text !== 'string') return [];

  // Clone regex with global flag to avoid state contamination
  let flags = regex.flags;
  if (!flags.includes('g')) {
    flags += 'g';
  }
  const safeRegex = new RegExp(regex.source, flags);

  const results = [];
  const startTime = Date.now();
  let match;

  while ((match = safeRegex.exec(text)) !== null) {
    if (Date.now() - startTime > MAX_MATCH_EXECUTION_TIME_MS) {
      break;
    }

    if (results.length >= maxMatches) {
      break;
    }

    // Guard against zero-width infinite loops
    if (match.index === safeRegex.lastIndex) {
      safeRegex.lastIndex++;
    }

    results.push({
      match: match[0],
      index: match.index,
      length: match[0].length
    });
  }

  return results;
}

module.exports = {
  validateSafeRegex,
  safeExecAll,
  MAX_PATTERN_LENGTH,
  MAX_MATCH_EXECUTION_TIME_MS
};
