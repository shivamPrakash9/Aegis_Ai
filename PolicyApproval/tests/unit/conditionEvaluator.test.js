// Unit Tests: Deterministic Condition Evaluator

const { evaluateCondition } = require('../../src/policy-engine/conditionEvaluator');

describe('Deterministic Condition Evaluator', () => {
  const sampleContext = {
    model: 'gpt-4o',
    provider: 'openai',
    callerRole: 'DATA_SCIENTIST',
    callerId: 'usr_12345',
    permissions: ['ai:generate', 'data:read'],
    totalPromptLength: 2500,
    messageCount: 3,
    metadata: {
      department: 'engineering',
      project: 'aegis',
      tags: ['production', 'internal']
    }
  };

  describe('Leaf Condition Operators', () => {
    test('eq and neq evaluate correctly', () => {
      expect(evaluateCondition({ field: 'model', operator: 'eq', value: 'gpt-4o' }, sampleContext)).toBe(true);
      expect(evaluateCondition({ field: 'model', operator: 'eq', value: 'claude-3-5' }, sampleContext)).toBe(false);
      expect(evaluateCondition({ field: 'model', operator: 'neq', value: 'claude-3-5' }, sampleContext)).toBe(true);
      expect(evaluateCondition({ field: 'model', operator: 'neq', value: 'gpt-4o' }, sampleContext)).toBe(false);
    });

    test('in and notIn evaluate correctly with array targets', () => {
      expect(
        evaluateCondition(
          { field: 'model', operator: 'in', value: ['gpt-4o', 'claude-3-5'] },
          sampleContext
        )
      ).toBe(true);

      expect(
        evaluateCondition(
          { field: 'model', operator: 'in', value: ['claude-3-5', 'gemini-1.5'] },
          sampleContext
        )
      ).toBe(false);

      expect(
        evaluateCondition(
          { field: 'model', operator: 'notIn', value: ['claude-3-5', 'gemini-1.5'] },
          sampleContext
        )
      ).toBe(true);
    });

    test('contains, startsWith, endsWith operators', () => {
      expect(evaluateCondition({ field: 'model', operator: 'contains', value: '-4o' }, sampleContext)).toBe(true);
      expect(evaluateCondition({ field: 'model', operator: 'contains', value: 'claude' }, sampleContext)).toBe(false);
      expect(evaluateCondition({ field: 'model', operator: 'startsWith', value: 'gpt-' }, sampleContext)).toBe(true);
      expect(evaluateCondition({ field: 'model', operator: 'startsWith', value: 'claude-' }, sampleContext)).toBe(false);
      expect(evaluateCondition({ field: 'model', operator: 'endsWith', value: '4o' }, sampleContext)).toBe(true);
    });

    test('numeric comparisons (gt, gte, lt, lte)', () => {
      expect(evaluateCondition({ field: 'totalPromptLength', operator: 'gt', value: 2000 }, sampleContext)).toBe(true);
      expect(evaluateCondition({ field: 'totalPromptLength', operator: 'gt', value: 3000 }, sampleContext)).toBe(false);
      expect(evaluateCondition({ field: 'totalPromptLength', operator: 'gte', value: 2500 }, sampleContext)).toBe(true);
      expect(evaluateCondition({ field: 'totalPromptLength', operator: 'lt', value: 3000 }, sampleContext)).toBe(true);
      expect(evaluateCondition({ field: 'totalPromptLength', operator: 'lte', value: 2500 }, sampleContext)).toBe(true);
      expect(evaluateCondition({ field: 'totalPromptLength', operator: 'lte', value: 2000 }, sampleContext)).toBe(false);
    });

    test('exists operator checks field presence', () => {
      expect(evaluateCondition({ field: 'model', operator: 'exists', value: true }, sampleContext)).toBe(true);
      expect(evaluateCondition({ field: 'nonexistentField', operator: 'exists', value: true }, sampleContext)).toBe(false);
      expect(evaluateCondition({ field: 'nonexistentField', operator: 'exists', value: false }, sampleContext)).toBe(true);
    });

    test('has_role operator checks caller role or permissions', () => {
      expect(evaluateCondition({ field: 'callerRole', operator: 'has_role', value: 'DATA_SCIENTIST' }, sampleContext)).toBe(true);
      expect(evaluateCondition({ field: 'permissions', operator: 'contains', value: 'ai:generate' }, sampleContext)).toBe(true);
      expect(evaluateCondition({ field: 'callerRole', operator: 'has_role', value: 'SUPER_ADMIN' }, sampleContext)).toBe(false);
    });

    test('nested property path extraction', () => {
      expect(evaluateCondition({ field: 'metadata.department', operator: 'eq', value: 'engineering' }, sampleContext)).toBe(true);
      expect(evaluateCondition({ field: 'metadata.project', operator: 'eq', value: 'aegis' }, sampleContext)).toBe(true);
      expect(evaluateCondition({ field: 'metadata.missing', operator: 'exists', value: false }, sampleContext)).toBe(true);
    });
  });

  describe('Composite Condition Operators', () => {
    test('all (logical AND) requires all sub-conditions to be true', () => {
      const condition = {
        all: [
          { field: 'model', operator: 'eq', value: 'gpt-4o' },
          { field: 'provider', operator: 'eq', value: 'openai' },
          { field: 'totalPromptLength', operator: 'lt', value: 5000 }
        ]
      };
      expect(evaluateCondition(condition, sampleContext)).toBe(true);

      const failingCondition = {
        all: [
          { field: 'model', operator: 'eq', value: 'gpt-4o' },
          { field: 'provider', operator: 'eq', value: 'anthropic' }
        ]
      };
      expect(evaluateCondition(failingCondition, sampleContext)).toBe(false);
    });

    test('any (logical OR) passes if at least one sub-condition is true', () => {
      const condition = {
        any: [
          { field: 'model', operator: 'eq', value: 'claude-3-5' },
          { field: 'model', operator: 'eq', value: 'gpt-4o' }
        ]
      };
      expect(evaluateCondition(condition, sampleContext)).toBe(true);

      const allFalse = {
        any: [
          { field: 'model', operator: 'eq', value: 'claude-3-5' },
          { field: 'model', operator: 'eq', value: 'gemini' }
        ]
      };
      expect(evaluateCondition(allFalse, sampleContext)).toBe(false);
    });

    test('not (logical negation) inverts condition', () => {
      const condition = {
        not: { field: 'model', operator: 'eq', value: 'claude-3-5' }
      };
      expect(evaluateCondition(condition, sampleContext)).toBe(true);

      const negatedTrue = {
        not: { field: 'model', operator: 'eq', value: 'gpt-4o' }
      };
      expect(evaluateCondition(negatedTrue, sampleContext)).toBe(false);
    });

    test('nested composite conditions evaluate deterministically', () => {
      const complexCondition = {
        all: [
          { field: 'provider', operator: 'eq', value: 'openai' },
          {
            any: [
              { field: 'callerRole', operator: 'eq', value: 'ADMIN' },
              { field: 'callerRole', operator: 'eq', value: 'DATA_SCIENTIST' }
            ]
          },
          {
            not: {
              field: 'metadata.department',
              operator: 'eq',
              value: 'finance'
            }
          }
        ]
      };
      expect(evaluateCondition(complexCondition, sampleContext)).toBe(true);
    });
  });

  describe('Security and Safety Bounds', () => {
    test('enforces bounded recursion depth (fails closed on depth > 5)', () => {
      // Create deeply nested structure with 7 levels
      const deepCondition = {
        all: [
          {
            all: [
              {
                all: [
                  {
                    all: [
                      {
                        all: [
                          {
                            all: [
                              { field: 'model', operator: 'eq', value: 'gpt-4o' }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      };

      expect(evaluateCondition(deepCondition, sampleContext)).toBe(false);
    });

    test('prevents prototype pollution property extraction', () => {
      const maliciousCondition = {
        field: '__proto__.polluted',
        operator: 'exists',
        value: true
      };
      expect(evaluateCondition(maliciousCondition, sampleContext)).toBe(false);

      const constructorCondition = {
        field: 'constructor.name',
        operator: 'exists',
        value: true
      };
      expect(evaluateCondition(constructorCondition, sampleContext)).toBe(false);
    });

    test('handles null, undefined, or empty conditions safely', () => {
      expect(evaluateCondition(null, sampleContext)).toBe(true);
      expect(evaluateCondition(undefined, sampleContext)).toBe(true);
      expect(evaluateCondition({}, sampleContext)).toBe(true);
    });

    test('fails closed on unknown operators', () => {
      const invalidOperator = {
        field: 'model',
        operator: 'evalDangerousCode',
        value: 'gpt-4o'
      };
      expect(evaluateCondition(invalidOperator, sampleContext)).toBe(false);
    });
  });
});
