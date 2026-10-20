// Indian Aadhaar-like Identifier Detector

const { BaseDetector } = require('./baseDetector');

// Verhoeff algorithm lookup tables for Indian UIDAI Aadhaar checksum
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];

const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

function validateVerhoeff(numStr) {
  let c = 0;
  const reversed = numStr.split('').reverse().map(Number);
  for (let i = 0; i < reversed.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][reversed[i]]];
  }
  return c === 0;
}

class AadhaarDetector extends BaseDetector {
  constructor() {
    super({
      category: 'AADHAAR',
      severity: 'HIGH',
      defaultAction: 'MASK',
      replacementPrefix: 'AADHAAR',
      description: 'Indian Aadhaar-like national identity number detected'
    });

    // Aadhaar numbers are 12 digits. First digit is never 0 or 1.
    // Formats: 1234 5678 9012 or 1234-5678-9012 or continuous 123456789012
    this.spacedAadhaarRegex = /\b([2-9]\d{3}[-\s]\d{4}[-\s]\d{4})\b/g;
    this.continuousAadhaarRegex = /\b([2-9]\d{11})\b/g;
  }

  detect(text, context = {}) {
    if (!text || typeof text !== 'string') return [];

    const matches = [];
    const seenSpans = new Set();

    const patterns = [
      { regex: this.spacedAadhaarRegex, isSpaced: true },
      { regex: this.continuousAadhaarRegex, isSpaced: false }
    ];

    for (const { regex, isSpaced } of patterns) {
      const re = new RegExp(regex.source, 'g');
      let match;

      while ((match = re.exec(text)) !== null) {
        const matchedText = match[1];
        const startIndex = match.index;
        const endIndex = startIndex + matchedText.length;

        // Boundary check: ensure not preceded or followed by digits or letters
        if (startIndex > 0 && /[a-zA-Z0-9]/.test(text[startIndex - 1])) {
          continue;
        }
        if (endIndex < text.length && /[a-zA-Z0-9]/.test(text[endIndex])) {
          continue;
        }

        const digitsOnly = matchedText.replace(/\D/g, '');
        if (digitsOnly.length !== 12) {
          continue;
        }

        // Check if all digits are identical (e.g. 999999999999) - commonly invalid or test
        if (/^(\d)\1{11}$/.test(digitsOnly)) {
          continue;
        }

        const spanKey = `${startIndex}-${endIndex}`;
        if (seenSpans.has(spanKey)) {
          continue;
        }
        seenSpans.add(spanKey);

        // Verhoeff checksum validation
        const isValidChecksum = validateVerhoeff(digitsOnly);

        // For spaced Aadhaar (e.g. XXXX XXXX XXXX), confidence is high even if checksum fails (e.g. synthetic test)
        // For continuous 12 digits, if checksum fails and there's no context, skip or reduce confidence to avoid timestamps
        if (!isSpaced && !isValidChecksum) {
          continue; // Avoid capturing generic 12-digit numbers
        }

        matches.push({
          category: this.category,
          severity: this.severity,
          defaultAction: this.defaultAction,
          startIndex,
          endIndex,
          matchedText,
          replacementPrefix: this.replacementPrefix,
          confidence: (isValidChecksum || isSpaced) ? 'HIGH' : 'MEDIUM',
          description: this.description
        });
      }
    }

    return matches;
  }

  getLimitations() {
    return {
      category: this.category,
      method: 'Structural 12-digit format check ([2-9]xxx xxxx xxxx) with Verhoeff mathematical checksum verification.',
      limitations: [
        'Matching this format and checksum does NOT verify an Aadhaar number with UIDAI or authenticate an individual.',
        'Does not connect to external UIDAI or Indian government identity databases.',
        'Continuous 12-digit strings failing the Verhoeff checksum are deliberately skipped to prevent false positives with timestamps, order IDs, and manufacturing serial numbers.'
      ]
    };
  }
}

module.exports = { AadhaarDetector };
