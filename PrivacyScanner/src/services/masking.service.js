// Safe Masking & Deterministic Transformation Engine

const SEVERITY_WEIGHTS = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

class MaskingService {
  /**
   * Resolves overlapping and conflicting matches deterministically.
   * Priority: Higher severity > Longer span > Earlier start position.
   *
   * @param {Array<object>} matches
   * @param {number} textLength
   * @returns {Array<object>} Non-overlapping matches sorted by startIndex ascending
   */
  resolveOverlaps(matches, textLength) {
    if (!matches || matches.length === 0) return [];

    // Sort by severity descending, then span length descending, then startIndex ascending
    const prioritized = [...matches].sort((a, b) => {
      const weightA = SEVERITY_WEIGHTS[a.severity] || 0;
      const weightB = SEVERITY_WEIGHTS[b.severity] || 0;
      if (weightB !== weightA) return weightB - weightA;

      const spanA = a.endIndex - a.startIndex;
      const spanB = b.endIndex - b.startIndex;
      if (spanB !== spanA) return spanB - spanA;

      return a.startIndex - b.startIndex;
    });

    const claimedIndices = new Uint8Array(textLength);
    const resolved = [];

    for (const match of prioritized) {
      const start = Math.max(0, match.startIndex);
      const end = Math.min(textLength, match.endIndex);

      if (start >= end) continue;

      let hasOverlap = false;
      for (let i = start; i < end; i++) {
        if (claimedIndices[i] === 1) {
          hasOverlap = true;
          break;
        }
      }

      if (!hasOverlap) {
        for (let i = start; i < end; i++) {
          claimedIndices[i] = 1;
        }
        resolved.push(match);
      }
    }

    // Sort final non-overlapping matches in reading order (startIndex ascending)
    return resolved.sort((a, b) => a.startIndex - b.startIndex);
  }

  /**
   * Applies deterministic masking to a string using non-overlapping matches.
   * Replacements are applied in reverse position order (end to start) to prevent index shifting.
   *
   * @param {string} text - Original input string
   * @param {Array<object>} matches - Non-overlapping matches
   * @param {Map<string, string>} valueToTokenMap - Consistent token mapping across the scan
   * @param {Map<string, number>} tokenCounterMap - Counter per token prefix
   * @returns {{
   *   sanitizedText: string,
   *   appliedFindings: Array<object>
   * }}
   */
  maskText(text, matches, valueToTokenMap, tokenCounterMap) {
    if (!text || typeof text !== 'string') {
      return { sanitizedText: text, appliedFindings: [] };
    }

    const resolved = this.resolveOverlaps(matches, text.length);
    if (resolved.length === 0) {
      return { sanitizedText: text, appliedFindings: [] };
    }

    const appliedFindings = [];

    // First pass: assign deterministic replacement tokens
    for (const match of resolved) {
      const prefix = match.replacementPrefix || match.category || 'REDACTED';
      const mapKey = `${prefix}:${match.matchedText}`;

      let token;
      if (valueToTokenMap.has(mapKey)) {
        token = valueToTokenMap.get(mapKey);
      } else {
        const count = (tokenCounterMap.get(prefix) || 0) + 1;
        tokenCounterMap.set(prefix, count);
        token = `[${prefix}_${count}]`;
        valueToTokenMap.set(mapKey, token);
      }

      appliedFindings.push({
        type: match.category,
        category: match.category,
        severity: match.severity,
        defaultAction: match.defaultAction,
        description: match.description,
        replacementToken: token,
        startIndex: match.startIndex,
        endIndex: match.endIndex
      });
    }

    // Second pass: apply replacements in reverse order (highest startIndex first)
    // to preserve accurate substring slice points
    let sanitizedText = text;
    for (let i = appliedFindings.length - 1; i >= 0; i--) {
      const finding = appliedFindings[i];
      const before = sanitizedText.slice(0, finding.startIndex);
      const after = sanitizedText.slice(finding.endIndex);
      sanitizedText = before + finding.replacementToken + after;
    }

    return {
      sanitizedText,
      appliedFindings
    };
  }

  /**
   * Masks an array of chat messages without mutating the original array or objects.
   *
   * @param {Array<{role: string, content: string}>} messages
   * @param {Map<number, Array<object>>} matchesByMessageIndex
   * @returns {{
   *   sanitizedMessages: Array<{role: string, content: string}>,
   *   findings: Array<object>
   * }}
   */
  maskMessages(messages, matchesByMessageIndex) {
    if (!Array.isArray(messages)) {
      return { sanitizedMessages: [], findings: [] };
    }

    const valueToTokenMap = new Map();
    const tokenCounterMap = new Map();
    const sanitizedMessages = [];
    const allFindings = [];

    for (let i = 0; i < messages.length; i++) {
      const originalMessage = messages[i];
      const matches = matchesByMessageIndex.get(i) || [];

      // Create new clean message object (no mutation)
      const sanitizedMessage = {
        role: originalMessage.role,
        content: originalMessage.content
      };

      if (typeof originalMessage.content === 'string') {
        const { sanitizedText, appliedFindings } = this.maskText(
          originalMessage.content,
          matches,
          valueToTokenMap,
          tokenCounterMap
        );

        sanitizedMessage.content = sanitizedText;

        for (const finding of appliedFindings) {
          allFindings.push({
            type: finding.type,
            category: finding.category,
            severity: finding.severity,
            defaultAction: finding.defaultAction,
            description: finding.description,
            replacementToken: finding.replacementToken,
            location: {
              messageIndex: i,
              startIndex: finding.startIndex,
              endIndex: finding.endIndex
            }
          });
        }
      }

      sanitizedMessages.push(sanitizedMessage);
    }

    return {
      sanitizedMessages,
      findings: allFindings
    };
  }
}

module.exports = {
  MaskingService,
  maskingService: new MaskingService()
};
