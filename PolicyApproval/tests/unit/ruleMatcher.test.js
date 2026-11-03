// Unit Tests: Rule Matcher and Rule Validation

const { validateRule, matchRules } = require('../../src/policy-engine/ruleMatcher');
const { BadRequestError } = require('../../src/utils/errors');

describe('Rule Matcher and Rule Validation', () => {
  describe('validateRule', () => {
    test('accepts well-formed rules', () => {
      const validRule = {
        id: 'rule-test-1',
        name: 'Valid Rule',
        effect: 'DENY',
        priority: 10,
        condition: { field: 'model', operator: 'eq', value: 'untrusted' },
        reason: 'Untrusted model'
      };

      expect(() => validateRule(validRule)).not.toThrow();
    });

    test('rejects rule without required fields', () => {
      expect(() => validateRule(null)).toThrow(BadRequestError);
      expect(() => validateRule({})).toThrow(BadRequestError);
      expect(() => validateRule({ id: 'r1', name: 'R1' })).toThrow(BadRequestError);
      expect(() => validateRule({ id: 'r1', name: 'R1', effect: 'UNKNOWN' })).toThrow(BadRequestError);
      expect(() => validateRule({ id: 'r1', name: 'R1', effect: 'ALLOW', condition: {} })).toThrow(BadRequestError);
    });

    test('rejects rule with non-object condition', () => {
      const invalid = {
        id: 'r1',
        name: 'R1',
        effect: 'ALLOW',
        reason: 'Test',
        condition: 'bad-string-condition'
      };
      expect(() => validateRule(invalid)).toThrow(BadRequestError);
    });
  });

  describe('matchRules', () => {
    const context = {
      model: 'gpt-4o',
      provider: 'openai',
      callerRole: 'MEMBER'
    };

    test('returns only matching rules ordered by priority', () => {
      const rules = [
        {
          id: 'rule_low_priority',
          name: 'Low Priority Match',
          effect: 'ALLOW',
          priority: 100,
          condition: { field: 'provider', operator: 'eq', value: 'openai' },
          reason: 'Matches provider'
        },
        {
          id: 'rule_high_priority',
          name: 'High Priority Match',
          effect: 'REQUIRE_APPROVAL',
          priority: 10,
          condition: { field: 'model', operator: 'eq', value: 'gpt-4o' },
          reason: 'Matches model'
        },
        {
          id: 'rule_no_match',
          name: 'No Match',
          effect: 'DENY',
          priority: 5,
          condition: { field: 'model', operator: 'eq', value: 'claude-3-5' },
          reason: 'Does not match'
        }
      ];

      const matched = matchRules(rules, context);
      expect(matched).toHaveLength(2);
      expect(matched[0].id).toBe('rule_high_priority');
      expect(matched[1].id).toBe('rule_low_priority');
    });

    test('returns empty array when no rules match', () => {
      const rules = [
        {
          id: 'rule_non_matching',
          name: 'Non Match',
          effect: 'DENY',
          condition: { field: 'callerRole', operator: 'eq', value: 'ADMIN' },
          reason: 'Only admins'
        }
      ];

      const matched = matchRules(rules, context);
      expect(matched).toEqual([]);
    });
  });
});
