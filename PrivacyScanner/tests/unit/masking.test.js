// Unit Tests: Deterministic Masking & Overlap Resolution Engine

const { MaskingService } = require('../../src/services/masking.service');

describe('Masking Service Unit Tests', () => {
  let maskingService;

  beforeEach(() => {
    maskingService = new MaskingService();
  });

  describe('resolveOverlaps', () => {
    it('should prioritize higher severity matches over lower severity overlapping matches', () => {
      const text = 'password=AKIAIOSFODNN7EXAMPLE';
      const textLength = text.length;

      const matches = [
        {
          category: 'CREDENTIAL_ASSIGNMENT',
          severity: 'HIGH',
          startIndex: 9,
          endIndex: 29,
          matchedText: 'AKIAIOSFODNN7EXAMPLE'
        },
        {
          category: 'SECRET',
          severity: 'CRITICAL', // Higher priority
          startIndex: 9,
          endIndex: 29,
          matchedText: 'AKIAIOSFODNN7EXAMPLE'
        }
      ];

      const resolved = maskingService.resolveOverlaps(matches, textLength);
      expect(resolved).toHaveLength(1);
      expect(resolved[0].severity).toBe('CRITICAL');
      expect(resolved[0].category).toBe('SECRET');
    });

    it('should prioritize longer span when severity is identical', () => {
      const text = 'Sample string with overlapping tokens';
      const textLength = text.length;

      const matches = [
        {
          category: 'TOKEN',
          severity: 'MEDIUM',
          startIndex: 7,
          endIndex: 13, // length 6
          matchedText: 'string'
        },
        {
          category: 'TOKEN_PHRASE',
          severity: 'MEDIUM',
          startIndex: 7,
          endIndex: 18, // length 11 (longer)
          matchedText: 'string with'
        }
      ];

      const resolved = maskingService.resolveOverlaps(matches, textLength);
      expect(resolved).toHaveLength(1);
      expect(resolved[0].category).toBe('TOKEN_PHRASE');
    });
  });

  describe('maskText', () => {
    it('should apply replacements without shifting index positions of neighboring matches', () => {
      const text = 'User alice@example.com called 555-0199 about account.';
      const matches = [
        {
          category: 'EMAIL',
          severity: 'MEDIUM',
          startIndex: 5,
          endIndex: 22,
          matchedText: 'alice@example.com',
          replacementPrefix: 'EMAIL',
          description: 'Email address'
        },
        {
          category: 'PHONE',
          severity: 'MEDIUM',
          startIndex: 30,
          endIndex: 38,
          matchedText: '555-0199',
          replacementPrefix: 'PHONE',
          description: 'Phone number'
        }
      ];

      const valueToTokenMap = new Map();
      const tokenCounterMap = new Map();

      const { sanitizedText, appliedFindings } = maskingService.maskText(
        text,
        matches,
        valueToTokenMap,
        tokenCounterMap
      );

      expect(sanitizedText).toBe('User [EMAIL_1] called [PHONE_1] about account.');
      expect(appliedFindings).toHaveLength(2);
      expect(appliedFindings[0].replacementToken).toBe('[EMAIL_1]');
      expect(appliedFindings[1].replacementToken).toBe('[PHONE_1]');
    });

    it('should reuse identical token for identical sensitive value across text', () => {
      const text = 'Primary: user@example.com, CC: user@example.com, Other: diff@example.com';
      const matches = [
        {
          category: 'EMAIL',
          severity: 'MEDIUM',
          startIndex: 9,
          endIndex: 25,
          matchedText: 'user@example.com',
          replacementPrefix: 'EMAIL'
        },
        {
          category: 'EMAIL',
          severity: 'MEDIUM',
          startIndex: 31,
          endIndex: 47,
          matchedText: 'user@example.com',
          replacementPrefix: 'EMAIL'
        },
        {
          category: 'EMAIL',
          severity: 'MEDIUM',
          startIndex: 56,
          endIndex: 72,
          matchedText: 'diff@example.com',
          replacementPrefix: 'EMAIL'
        }
      ];

      const valueToTokenMap = new Map();
      const tokenCounterMap = new Map();

      const { sanitizedText } = maskingService.maskText(
        text,
        matches,
        valueToTokenMap,
        tokenCounterMap
      );

      expect(sanitizedText).toBe('Primary: [EMAIL_1], CC: [EMAIL_1], Other: [EMAIL_2]');
    });
  });

  describe('maskMessages', () => {
    it('SECURITY REQUIREMENT: must NOT mutate caller original messages or findings objects', () => {
      const originalMessages = [
        { role: 'user', content: 'Contact me at secret@example.com' }
      ];
      const deepFrozenOriginal = JSON.parse(JSON.stringify(originalMessages));

      const matchesByMessageIndex = new Map();
      matchesByMessageIndex.set(0, [
        {
          category: 'EMAIL',
          severity: 'MEDIUM',
          startIndex: 14,
          endIndex: 32,
          matchedText: 'secret@example.com',
          replacementPrefix: 'EMAIL',
          description: 'Email detected'
        }
      ]);

      const result = maskingService.maskMessages(originalMessages, matchesByMessageIndex);

      // Verify original is pristine
      expect(originalMessages).toEqual(deepFrozenOriginal);
      expect(originalMessages[0].content).toBe('Contact me at secret@example.com');

      // Verify sanitized messages
      expect(result.sanitizedMessages[0].content).toBe('Contact me at [EMAIL_1]');

      // Verify findings do NOT include raw matchedText
      expect(result.findings[0]).not.toHaveProperty('matchedText');
      expect(result.findings[0].replacementToken).toBe('[EMAIL_1]');
    });
  });
});
