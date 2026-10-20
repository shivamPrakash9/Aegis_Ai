// IPv4 Address Detector

const { BaseDetector } = require('./baseDetector');

class IpAddressDetector extends BaseDetector {
  constructor() {
    super({
      category: 'IP_ADDRESS',
      severity: 'LOW',
      defaultAction: 'MASK',
      replacementPrefix: 'IP_ADDRESS',
      description: 'IPv4 network address detected'
    });

    this.ipv4Regex = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g;
  }

  detect(text, context = {}) {
    if (!text || typeof text !== 'string') return [];

    const matches = [];
    const regex = new RegExp(this.ipv4Regex.source, 'g');
    let match;

    while ((match = regex.exec(text)) !== null) {
      const matchedText = match[1];
      const startIndex = match.index;
      const endIndex = startIndex + matchedText.length;

      // Check for version prefix (e.g., v1.2.3.4)
      if (startIndex > 0 && (text[startIndex - 1] === 'v' || text[startIndex - 1] === 'V')) {
        continue;
      }

      // Check if followed by additional dot (e.g. 1.2.3.4.5)
      if (endIndex < text.length && text[endIndex] === '.') {
        continue;
      }

      // Validate each octet is 0-255
      const octets = matchedText.split('.').map(Number);
      if (octets.length !== 4 || octets.some((o) => isNaN(o) || o < 0 || o > 255)) {
        continue;
      }

      // Prevent leading zeros in octets (e.g. 192.168.001.001 which is invalid/ambiguous)
      const hasInvalidLeadingZeros = matchedText.split('.').some((part) => part.length > 1 && part.startsWith('0'));
      if (hasInvalidLeadingZeros) {
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
      method: 'Structural IPv4 4-octet bounded numerical validation (0-255).',
      limitations: [
        'IPv6 addresses are not matched by this detector.',
        'Does not distinguish between public, private (RFC 1918), and reserved IP blocks.',
        'Semantic semantic software version numbers without version prefixes may match if four single-byte octets are used.'
      ]
    };
  }
}

module.exports = { IpAddressDetector };
