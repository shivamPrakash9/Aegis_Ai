// Phone Number Detector

const { BaseDetector } = require('./baseDetector');

class PhoneDetector extends BaseDetector {
  constructor() {
    super({
      category: 'PHONE',
      severity: 'MEDIUM',
      defaultAction: 'MASK',
      replacementPrefix: 'PHONE',
      description: 'Telephone / mobile number detected'
    });

    // Pattern 1: International with explicit '+' prefix: +1 555-123-4567, +91-9876543210, +44 20 7946 0958
    this.intlPhoneRegex = /(?:\+([1-9]\d{0,2}))[-.\s]?(?:\(?\d{1,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}(?:[-.\s]?\d{1,4})?/g;

    // Pattern 2: US / NANP: (555) 019-2834, 555-0199, 800-555-0199, 1-800-555-0199
    this.usPhoneRegex = /(?:(?:\+?1[-.\s]*)?(?:\([2-9]\d{2}\)|[2-9]\d{2})[-.\s]+)?\b\d{3}[-.\s]\d{4}\b/g;

    // Pattern 3: Indian Mobile: 10 digits starting with 6,7,8,9 with optional +91 or 0 prefix: +91 98765 43210, 09876543210, 98765-43210
    this.indiaPhoneRegex = /(?:(?:\+91|0)[-.\s]?)?[6-9]\d{4}[-.\s]?\d{5}\b/g;
  }

  detect(text, context = {}) {
    if (!text || typeof text !== 'string') return [];

    const matches = [];
    const seenSpans = new Set();

    const patterns = [
      { regex: this.intlPhoneRegex, minDigits: 7, maxDigits: 15 },
      { regex: this.usPhoneRegex, minDigits: 7, maxDigits: 11 },
      { regex: this.indiaPhoneRegex, minDigits: 10, maxDigits: 12 }
    ];

    for (const { regex, minDigits, maxDigits } of patterns) {
      const re = new RegExp(regex.source, 'gi');
      let match;

      while ((match = re.exec(text)) !== null) {
        let matchedText = match[0];
        let startIndex = match.index;
        let endIndex = startIndex + matchedText.length;

        // Trim trailing punctuation like comma, dot, parens
        while (matchedText.length > 0 && /[.,;:!?)'"\]]/.test(matchedText[matchedText.length - 1])) {
          matchedText = matchedText.slice(0, -1);
          endIndex--;
        }

        // Count only digits
        const digits = matchedText.replace(/\D/g, '');
        if (digits.length < minDigits || digits.length > maxDigits) {
          continue;
        }

        // Filter out dates (e.g., 2026-10-19 or 1999-12-31)
        if (/^\d{4}[-./]\d{2}[-./]\d{2}$/.test(matchedText)) {
          continue;
        }

        // Filter out software versions (e.g. 1.2.3.4)
        if (/^\d+\.\d+\.\d+(\.\d+)?$/.test(matchedText)) {
          continue;
        }

        // Check if word boundary before starts with letter or digit (avoid matching inside strings like abc123456789)
        if (startIndex > 0 && /[a-zA-Z0-9]/.test(text[startIndex - 1])) {
          continue;
        }

        const spanKey = `${startIndex}-${endIndex}`;
        if (seenSpans.has(spanKey)) {
          continue;
        }
        seenSpans.add(spanKey);

        matches.push({
          category: this.category,
          severity: this.severity,
          defaultAction: this.defaultAction,
          startIndex,
          endIndex,
          matchedText,
          replacementPrefix: this.replacementPrefix,
          confidence: 'MEDIUM',
          description: this.description
        });
      }
    }

    return matches;
  }

  getLimitations() {
    return {
      category: this.category,
      method: 'Format-specific regular expressions for International (E.164-like), US/NANP, and Indian mobile numbering plans.',
      limitations: [
        'Does not verify active carrier assignment or HLR lookup.',
        'Arbitrary long digit strings without telephone formatting or valid dialing prefixes are rejected to prevent false positives with timestamps or credit cards.',
        'Supported regions are explicitly International (+prefix), US/Canada (NANP), and India.'
      ]
    };
  }
}

module.exports = { PhoneDetector };
