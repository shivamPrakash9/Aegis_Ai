// Credential Assignment Detector (password=..., api_key=..., client_secret=...)

const { BaseDetector } = require('./baseDetector');

class CredentialAssignmentDetector extends BaseDetector {
  constructor() {
    super({
      category: 'CREDENTIAL_ASSIGNMENT',
      severity: 'HIGH',
      defaultAction: 'BLOCK',
      replacementPrefix: 'SECRET',
      description: 'Potential credential assignment detected'
    });

    // Matches key = value or key: value
    this.assignmentRegex = /\b(password|passwd|pwd|client_secret|api_key|apikey|secret_key|auth_token|access_token|db_password)\s*[:=]\s*(?:(["'])(.*?)\2|([^\s"';,]+))/gi;

    // Common non-sensitive values to ignore
    this.ignoredValues = new Set([
      '', 'null', 'undefined', 'true', 'false', 'none', 'nil',
      '[redacted]', '[masked]', '[secret_1]', 'string', 'your_password',
      'changeme', 'example', 'placeholder', '***'
    ]);
  }

  detect(text, context = {}) {
    if (!text || typeof text !== 'string') return [];

    const matches = [];
    const regex = new RegExp(this.assignmentRegex.source, 'gi');
    let match;

    while ((match = regex.exec(text)) !== null) {
      const fullMatch = match[0];
      const keyName = match[1];
      const quoteChar = match[2];
      const quotedValue = match[3];
      const unquotedValue = match[4];

      const rawSecretValue = (quotedValue !== undefined ? quotedValue : unquotedValue) || '';
      const normalizedValue = rawSecretValue.trim().toLowerCase();

      // Skip obvious placeholders or empty values
      if (this.ignoredValues.has(normalizedValue) || normalizedValue.length < 3) {
        continue;
      }

      // Do not re-mask already masked tokens
      if (/^\[SECRET_\d+\]$/i.test(normalizedValue)) {
        continue;
      }

      // Identify the exact span of the secret value to redact
      const valueStartIndex = match.index + fullMatch.lastIndexOf(rawSecretValue);
      const valueEndIndex = valueStartIndex + rawSecretValue.length;

      matches.push({
        category: this.category,
        severity: this.severity,
        defaultAction: this.defaultAction, // BLOCK
        startIndex: valueStartIndex,
        endIndex: valueEndIndex,
        matchedText: rawSecretValue, // Used strictly internally for replacement calculation, never logged
        replacementPrefix: this.replacementPrefix,
        confidence: 'HIGH',
        description: `Credential assignment for key '${keyName}' detected`
      });
    }

    return matches;
  }

  getLimitations() {
    return {
      category: this.category,
      method: 'Contextual keyword assignment parsing (e.g. password=..., api_key=...) for configuration and script text.',
      limitations: [
        'Relies on recognized keyword identifiers preceding the secret assignment.',
        'Credentials passed without an identifiable parameter name (e.g. raw unstructured passwords) are difficult to distinguish from high-entropy text and require token signature detection.',
        'Common dummy values (e.g. changeme, your_password) are intentionally skipped to prevent false positives in test scripts.'
      ]
    };
  }
}

module.exports = { CredentialAssignmentDetector };
