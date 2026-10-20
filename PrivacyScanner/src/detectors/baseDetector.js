// Base Detector Interface for Privacy Scanner

class BaseDetector {
  /**
   * @param {object} options
   * @param {string} options.category Category identifier (e.g., 'EMAIL', 'SECRET')
   * @param {string} options.severity Default severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
   * @param {string} options.defaultAction Default decision: 'ALLOW' | 'BLOCK' | 'MASK' | 'ROUTE' | 'REQUIRE_APPROVAL'
   * @param {string} options.replacementPrefix Prefix used for masking token (e.g. 'EMAIL' -> '[EMAIL_1]')
   * @param {string} options.description Human-readable category description
   */
  constructor({ category, severity, defaultAction, replacementPrefix, description }) {
    this.category = category;
    this.severity = severity;
    this.defaultAction = defaultAction;
    this.replacementPrefix = replacementPrefix || category;
    this.description = description;
  }

  /**
   * Detects sensitive patterns within the given input text.
   *
   * @param {string} text - Input text string to scan
   * @param {object} [context] - Optional scan context (e.g. organizationId, messageIndex)
   * @returns {Array<{
   *   category: string,
   *   severity: string,
   *   defaultAction: string,
   *   startIndex: number,
   *   endIndex: number,
   *   matchedText: string,
   *   replacementPrefix: string,
   *   confidence: string,
   *   description: string
   * }>}
   */
  detect(text, context = {}) {
    throw new Error('detect() must be implemented by subclass');
  }

  /**
   * Returns metadata and known limitations of the detector.
   * @returns {{ category: string, method: string, limitations: string[] }}
   */
  getLimitations() {
    return {
      category: this.category,
      method: 'Regular Expression / Pattern Matching',
      limitations: []
    };
  }
}

module.exports = { BaseDetector };
