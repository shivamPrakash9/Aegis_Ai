// Unit Tests: Regular Expression Safety & ReDoS Protection

const { validateSafeRegex, safeExecAll } = require('../../src/utils/regexSafety');
const { BadRequestError } = require('../../src/utils/errors');

describe('Regex Safety Unit Tests', () => {
  it('should accept and compile safe regular expression patterns', () => {
    const pattern = '\\bProject\\s+Omega\\b';
    const regex = validateSafeRegex(pattern, 'gi');

    expect(regex).toBeInstanceOf(RegExp);
    expect(regex.test('This is Project Omega announcement.')).toBe(true);
  });

  it('SECURITY REQUIREMENT: rejects patterns susceptible to catastrophic backtracking (ReDoS)', () => {
    // Nested quantifiers: (a+)+
    expect(() => validateSafeRegex('([a-zA-Z]+)+')).toThrow(BadRequestError);

    // Group with star followed by plus: (a*)+
    expect(() => validateSafeRegex('([0-9]*)+')).toThrow(BadRequestError);

    // Overlapping alternation with quantifier: (a|aa)+
    expect(() => validateSafeRegex('(x|xx)+')).toThrow(BadRequestError);
  });

  it('SECURITY REQUIREMENT: rejects patterns exceeding maximum length', () => {
    const hugePattern = 'a'.repeat(350);
    expect(() => validateSafeRegex(hugePattern)).toThrow(BadRequestError);
  });

  it('should execute safeExecAll with loop limits and return correct match spans', () => {
    const pattern = /token\d+/g;
    const text = 'token1 other text token2 and token3';

    const matches = safeExecAll(pattern, text);
    expect(matches).toHaveLength(3);
    expect(matches[0].match).toBe('token1');
    expect(matches[0].index).toBe(0);
    expect(matches[1].match).toBe('token2');
    expect(matches[1].index).toBe(18);
  });
});
