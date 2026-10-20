// Unit Tests: Policy Decision Resolver and Precedence

const { resolveDecision } = require('../../src/policy-engine/decisionResolver');

describe('Decision Resolver (DENY > REQUIRE_APPROVAL > ALLOW)', () => {
  test('returns ALLOW when evaluated policies list is empty', () => {
    const result = resolveDecision([]);
    expect(result.decision).toBe('ALLOW');
    expect(result.violations).toEqual([]);
    expect(result.requiredApprovers).toEqual([]);
  });

  test('resolves ALLOW when matched rules only contain ALLOW', () => {
    const evaluated = [
      {
        policyId: 'pol_1',
        policyName: 'Standard Allow Policy',
        policyVersion: 1,
        matchedRules: [
          {
            id: 'rule_allow_standard',
            name: 'Allow standard models',
            effect: 'ALLOW',
            priority: 100,
            reason: 'Model is approved'
          }
        ]
      }
    ];

    const result = resolveDecision(evaluated);
    expect(result.decision).toBe('ALLOW');
    expect(result.violations).toHaveLength(0);
  });

  test('resolves REQUIRE_APPROVAL when matched rules include approval gates', () => {
    const evaluated = [
      {
        policyId: 'pol_1',
        policyName: 'Approval Policy',
        policyVersion: 2,
        matchedRules: [
          {
            id: 'rule_allow',
            name: 'Allow general',
            effect: 'ALLOW',
            priority: 100,
            reason: 'General access'
          },
          {
            id: 'rule_appr_frontier',
            name: 'Require approval for frontier models',
            effect: 'REQUIRE_APPROVAL',
            priority: 50,
            reason: 'Frontier model requires compliance approval',
            reasonCode: 'REQUIRE_COMPLIANCE_SIGN_OFF',
            requiredApprovers: ['COMPLIANCE_OFFICER', 'MANAGER']
          }
        ]
      }
    ];

    const result = resolveDecision(evaluated);
    expect(result.decision).toBe('REQUIRE_APPROVAL');
    expect(result.reasonCode).toBe('REQUIRE_COMPLIANCE_SIGN_OFF');
    expect(result.requiredApprovers).toContain('COMPLIANCE_OFFICER');
    expect(result.requiredApprovers).toContain('MANAGER');
    expect(result.triggeringRuleId).toBe('rule_appr_frontier');
  });

  test('DENY strictly overrides REQUIRE_APPROVAL and ALLOW (precedence test)', () => {
    const evaluated = [
      {
        policyId: 'pol_1',
        policyName: 'General Allow Policy',
        policyVersion: 1,
        matchedRules: [
          {
            id: 'rule_allow',
            name: 'General Allow',
            effect: 'ALLOW',
            priority: 100,
            reason: 'Permitted'
          }
        ]
      },
      {
        policyId: 'pol_2',
        policyName: 'Gate Policy',
        policyVersion: 1,
        matchedRules: [
          {
            id: 'rule_appr',
            name: 'Manager Approval Gate',
            effect: 'REQUIRE_APPROVAL',
            priority: 50,
            reason: 'Requires approval',
            requiredApprovers: ['MANAGER']
          }
        ]
      },
      {
        policyId: 'pol_3',
        policyName: 'Blocklist Policy',
        policyVersion: 1,
        matchedRules: [
          {
            id: 'rule_deny_untrusted',
            name: 'Block Untrusted Providers',
            effect: 'DENY',
            priority: 10,
            reason: 'Provider is prohibited by enterprise security',
            reasonCode: 'SECURITY_PROVIDER_PROHIBITED'
          }
        ]
      }
    ];

    const result = resolveDecision(evaluated);
    expect(result.decision).toBe('DENY');
    expect(result.reasonCode).toBe('SECURITY_PROVIDER_PROHIBITED');
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
    expect(result.violations[0].rule).toBe('rule_deny_untrusted');
    expect(result.violations[0].reason).toBe('Provider is prohibited by enterprise security');
  });

  test('deduplicates required approvers across multiple approval rules', () => {
    const evaluated = [
      {
        policyId: 'pol_1',
        policyName: 'Gate 1',
        policyVersion: 1,
        matchedRules: [
          {
            id: 'rule_appr_1',
            effect: 'REQUIRE_APPROVAL',
            priority: 50,
            reason: 'Gate 1 triggered',
            requiredApprovers: ['MANAGER', 'SECURITY_ADMIN']
          }
        ]
      },
      {
        policyId: 'pol_2',
        policyName: 'Gate 2',
        policyVersion: 1,
        matchedRules: [
          {
            id: 'rule_appr_2',
            effect: 'REQUIRE_APPROVAL',
            priority: 40,
            reason: 'Gate 2 triggered',
            requiredApprovers: ['SECURITY_ADMIN', 'COMPLIANCE_OFFICER']
          }
        ]
      }
    ];

    const result = resolveDecision(evaluated);
    expect(result.requiredApprovers).toEqual(
      expect.arrayContaining(['SECURITY_ADMIN', 'COMPLIANCE_OFFICER', 'MANAGER'])
    );
    expect(result.requiredApprovers).toHaveLength(3);
  });
});
