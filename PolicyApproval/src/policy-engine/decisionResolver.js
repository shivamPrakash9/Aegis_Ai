// Deterministic Decision Precedence Resolver (DENY > REQUIRE_APPROVAL > ALLOW)

const DECISION_WEIGHTS = {
  DENY: 3,
  REQUIRE_APPROVAL: 2,
  ALLOW: 1
};

/**
 * Resolves final governance decision from all matched rules across active policies.
 *
 * @param {Array<{
 *   policyId: string,
 *   policyName: string,
 *   policyVersion: number,
 *   matchedRules: Array<{
 *     ruleId: string,
 *     name: string,
 *     effect: 'DENY' | 'REQUIRE_APPROVAL' | 'ALLOW',
 *     reason: string,
 *     requiredApprovers: Array<string>
 *   }>
 * }>} evaluatedPolicies
 * @returns {{
 *   decision: 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL',
 *   reasonCode: string,
 *   reason: string,
 *   violations: Array<{ policyId: string, rule: string, reason: string }>,
 *   requiredApprovers: Array<string>,
 *   triggeringPolicyId?: string,
 *   triggeringRuleId?: string,
 *   policyVersion: number
 * }}
 */
function resolveDecision(evaluatedPolicies) {
  const violations = [];
  const requiredApproversSet = new Set();
  let highestDecision = 'ALLOW';
  let primaryReason = 'Governance policy evaluation passed.';
  let reasonCode = 'POLICY_PASSED';
  let triggeringPolicyId = undefined;
  let triggeringRuleId = undefined;
  let highestVersion = 1;

  const denyRules = [];
  const approvalRules = [];

  for (const item of evaluatedPolicies) {
    if (item.policyVersion > highestVersion) {
      highestVersion = item.policyVersion;
    }

    for (const rule of item.matchedRules) {
      const ruleIdentifier = rule.ruleId || rule.id;
      if (rule.effect === 'DENY') {
        denyRules.push({ ...rule, ruleId: ruleIdentifier, policyId: item.policyId });
        violations.push({
          policyId: item.policyId,
          rule: ruleIdentifier,
          reason: rule.reason
        });
      } else if (rule.effect === 'REQUIRE_APPROVAL') {
        approvalRules.push({ ...rule, ruleId: ruleIdentifier, policyId: item.policyId });
        for (const approver of (rule.requiredApprovers || [])) {
          requiredApproversSet.add(approver);
        }
      }
    }
  }

  if (denyRules.length > 0) {
    denyRules.sort((a, b) => (a.priority || 100) - (b.priority || 100));
    const primaryDeny = denyRules[0];
    highestDecision = 'DENY';
    reasonCode = primaryDeny.reasonCode || 'POLICY_DENIED';
    primaryReason = primaryDeny.reason;
    triggeringPolicyId = primaryDeny.policyId;
    triggeringRuleId = primaryDeny.ruleId || primaryDeny.id;
  } else if (approvalRules.length > 0) {
    approvalRules.sort((a, b) => (a.priority || 100) - (b.priority || 100));
    const primaryApproval = approvalRules[0];
    highestDecision = 'REQUIRE_APPROVAL';
    reasonCode = primaryApproval.reasonCode || 'APPROVAL_REQUIRED';
    primaryReason = primaryApproval.reason;
    triggeringPolicyId = primaryApproval.policyId;
    triggeringRuleId = primaryApproval.ruleId || primaryApproval.id;
  }

  // If REQUIRE_APPROVAL but no specific approvers listed, default to ORGANIZATION_ADMIN
  if (highestDecision === 'REQUIRE_APPROVAL' && requiredApproversSet.size === 0) {
    requiredApproversSet.add('ORGANIZATION_ADMIN');
  }

  return {
    decision: highestDecision,
    reasonCode,
    reason: primaryReason,
    violations,
    requiredApprovers: Array.from(requiredApproversSet),
    triggeringPolicyId,
    triggeringRuleId,
    policyVersion: highestVersion
  };
}

module.exports = {
  resolveDecision,
  DECISION_WEIGHTS
};
