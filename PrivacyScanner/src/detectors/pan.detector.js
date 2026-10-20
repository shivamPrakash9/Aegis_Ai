// Indian Permanent Account Number (PAN) Identifier Detector

const { BaseDetector } = require('./baseDetector');

class PanDetector extends BaseDetector {
  constructor() {
    super({
      category: 'PAN',
      severity: 'HIGH',
      defaultAction: 'MASK',
      replacementPrefix: 'PAN',
      description: 'Indian PAN-like tax identifier detected'
    });

    // 5 letters, 4 digits, 1 letter. 4th letter is typically P, C, H, A, B, G, J, L, F, T
    this.panRegex = /\b([A-Z]{5}[0-9]{4}[A-Z])\b/g;
  }

  detect(text, context = {}) {
    if (!text || typeof text !== 'string') return [];

    const matches = [];
    const regex = new RegExp(this.panRegex.source, 'g');
    let match;

    while ((match = regex.exec(text)) !== null) {
      const matchedText = match[1];
      const startIndex = match.index;
      const endIndex = startIndex + matchedText.length;

      // Strict boundary check: ensure preceding and succeeding characters are not alphanumeric
      if (startIndex > 0 && /[a-zA-Z0-9]/.test(text[startIndex - 1])) {
        continue;
      }
      if (endIndex < text.length && /[a-zA-Z0-9]/.test(text[endIndex])) {
        continue;
      }

      // 4th character check for valid tax status letter: P, C, H, A, B, G, J, L, F, T
      const fourthChar = matchedText[3];
      const validStatuses = ['P', 'C', 'H', 'A', 'B', 'G', 'J', 'L', 'F', 'T'];
      const confidence = validStatuses.includes(fourthChar) ? 'HIGH' : 'MEDIUM';

      matches.push({
        category: this.category,
        severity: this.severity,
        defaultAction: this.defaultAction,
        startIndex,
        endIndex,
        matchedText,
        replacementPrefix: this.replacementPrefix,
        confidence,
        description: this.description
      });
    }

    return matches;
  }

  getLimitations() {
    return {
      category: this.category,
      method: 'Format verification of 10-character alphanumeric Indian PAN pattern ([A-Z]{5}[0-9]{4}[A-Z]) with tax entity status character check.',
      limitations: [
        'Matching this format does NOT prove that the identifier is valid, active, or belongs to a real taxpayer.',
        'Does not query the NSDL / Income Tax Department database or perform external government verification.',
        'Synthetic or randomly generated alphanumeric strings matching the 5-letter, 4-digit, 1-letter structure may cause false positives.'
      ]
    };
  }
}

module.exports = { PanDetector };
