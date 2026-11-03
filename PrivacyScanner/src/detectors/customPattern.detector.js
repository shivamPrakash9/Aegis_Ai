// Organization-Configured Sensitive Keyword and Custom Pattern Detector

const { BaseDetector } = require('./baseDetector');
const { validateSafeRegex, safeExecAll } = require('../utils/regexSafety');

class CustomPatternDetector extends BaseDetector {
  constructor() {
    super({
      category: 'CUSTOM',
      severity: 'HIGH',
      defaultAction: 'MASK',
      replacementPrefix: 'CONFIDENTIAL',
      description: 'Organization-configured sensitive pattern or keyword detected'
    });
  }

  /**
   * Executes custom patterns configured for the scanning organization.
   *
   * @param {string} text
   * @param {object} context
   * @param {Array<{
   *   id: string,
   *   name: string,
   *   category?: string,
   *   pattern: string,
   *   severity?: string,
   *   action?: string,
   *   replacement?: string
   * }>} [context.customPatterns]
   * @returns {Array<object>}
   */
  detect(text, context = {}) {
    if (!text || typeof text !== 'string') return [];
    const customPatterns = context.customPatterns || [];
    if (!Array.isArray(customPatterns) || customPatterns.length === 0) {
      return [];
    }

    const matches = [];

    for (const rule of customPatterns) {
      if (!rule || !rule.pattern) continue;

      let safeRegex;
      try {
        safeRegex = validateSafeRegex(rule.pattern, 'gi');
      } catch (err) {
        // Skip invalid or unsafe regex to protect execution
        continue;
      }

      const matchResults = safeExecAll(safeRegex, text);

      for (const m of matchResults) {
        const category = rule.category || 'CUSTOM';
        const severity = rule.severity || 'HIGH';
        const defaultAction = rule.action || 'MASK';
        const replacementPrefix = rule.replacement || category;

        matches.push({
          category,
          severity,
          defaultAction,
          startIndex: m.index,
          endIndex: m.index + m.length,
          matchedText: m.match,
          replacementPrefix,
          confidence: 'HIGH',
          description: `Custom organization rule '${rule.name}' matched`
        });
      }
    }

    return matches;
  }

  getLimitations() {
    return {
      category: this.category,
      method: 'ReDoS-validated user-configured regular expressions and keyword matches.',
      limitations: [
        'Patterns exceeding complexity or length limits are rejected for safety.',
        'Execution duration is strictly capped to protect against denial-of-service.',
        'Does not support dynamic external lookups or runtime code evaluation.'
      ]
    };
  }
}

module.exports = { CustomPatternDetector };
