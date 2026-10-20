// Email Address Detector

const { BaseDetector } = require('./baseDetector');

class EmailDetector extends BaseDetector {
  constructor() {
    super({
      category: 'EMAIL',
      severity: 'MEDIUM',
      defaultAction: 'MASK',
      replacementPrefix: 'EMAIL',
      description: 'Email address detected'
    });

    // Matches standard emails, plus-tagging, subdomains, mixed case
    // Using word boundaries and non-punctuation endings
    this.emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  }

  detect(text, context = {}) {
    if (!text || typeof text !== 'string') return [];

    const matches = [];
    const regex = new RegExp(this.emailRegex.source, 'gi');
    let match;

    while ((match = regex.exec(text)) !== null) {
      let matchedText = match[0];
      let startIndex = match.index;
      let endIndex = startIndex + matchedText.length;

      // Clean trailing punctuation attached by boundary or regex (e.g. email in parentheses or ending a sentence)
      while (matchedText.length > 0 && /[.,;:!?)'"\]]/.test(matchedText[matchedText.length - 1])) {
        matchedText = matchedText.slice(0, -1);
        endIndex--;
      }

      // Re-verify valid email structure after punctuation trim
      if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(matchedText)) {
        continue;
      }

      // Check for consecutive dots in domain or local part
      if (matchedText.includes('..') || matchedText.startsWith('.') || matchedText.includes('@.')) {
        continue;
      }

      matches.push({
        category: this.category,
        severity: this.severity,
        defaultAction: this.defaultAction,
        startIndex,
        endIndex,
        matchedText,
        replacementPrefix: this.replacementPrefix,
        confidence: 'HIGH',
        description: this.description
      });
    }

    return matches;
  }

  getLimitations() {
    return {
      category: this.category,
      method: 'Regular Expression pattern matching',
      limitations: [
        'Does not perform DNS MX record validation or deliverability verification.',
        'Intentional simplification; does not match uncommon RFC 5322 quoted-string local parts.',
        'Obfuscated emails (e.g. user [at] example [dot] com) are not matched by deterministic regex.'
      ]
    };
  }
}

module.exports = { EmailDetector };
