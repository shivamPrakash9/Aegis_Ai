// Privacy Decision Evaluation Service

const DECISION_PRECEDENCE = {
  BLOCK: 5,
  REQUIRE_APPROVAL: 4,
  MASK: 3,
  ROUTE: 2,
  ALLOW: 1
};

class DecisionService {
  /**
   * Evaluates overall privacy scan decision based on detected findings and deterministic precedence.
   * Precedence order: BLOCK > REQUIRE_APPROVAL > MASK > ROUTE > ALLOW.
   *
   * @param {object} params
   * @param {Array<object>} params.findings
   * @param {string} [params.mode='MASK'] Requested mode (MASK | BLOCK | AUDIT)
   * @param {boolean} [params.maskingSucceeded=true]
   * @param {object} [params.scannerConfig]
   * @returns {{
   *   action: 'ALLOW' | 'BLOCK' | 'MASK' | 'ROUTE' | 'REQUIRE_APPROVAL',
   *   decision: 'ALLOW' | 'BLOCK' | 'MASK' | 'ROUTE' | 'REQUIRE_APPROVAL',
   *   reason: string,
   *   routingConstraints?: object
   * }}
   */
  evaluateDecision({ findings = [], mode = 'MASK', maskingSucceeded = true, scannerConfig = {} }) {
    // Security Rule: If sensitive findings exist and masking failed or produced an unsafe state, halt with BLOCK
    if (findings.length > 0 && !maskingSucceeded) {
      return {
        action: 'BLOCK',
        decision: 'BLOCK',
        reason: 'Masking transformation could not be verified safely; request blocked for data security.'
      };
    }

    if (!findings || findings.length === 0) {
      return {
        action: 'ALLOW',
        decision: 'ALLOW',
        reason: 'No sensitive entities detected in scanned content.'
      };
    }

    let highestAction = 'ALLOW';
    let highestRank = DECISION_PRECEDENCE.ALLOW;
    let primaryReason = '';
    let routingConstraints = undefined;

    for (const finding of findings) {
      let candidateAction = finding.defaultAction || 'MASK';

      // If mode is strictly BLOCK, any detected finding triggers BLOCK
      if (mode === 'BLOCK') {
        candidateAction = 'BLOCK';
      }

      // Prohibited secrets and credential assignments are non-negotiable BLOCK
      if (finding.category === 'SECRET' || finding.category === 'CREDENTIAL_ASSIGNMENT' || finding.severity === 'CRITICAL') {
        candidateAction = 'BLOCK';
      }

      const rank = DECISION_PRECEDENCE[candidateAction] || DECISION_PRECEDENCE.ALLOW;

      if (rank > highestRank) {
        highestRank = rank;
        highestAction = candidateAction;
        primaryReason = `${finding.category} detected (${finding.description || finding.category}).`;

        if (finding.routingConstraints) {
          routingConstraints = finding.routingConstraints;
        }
      }
    }

    return {
      action: highestAction,
      decision: highestAction,
      reason: primaryReason || `Privacy decision determined by ${highestAction} precedence.`,
      routingConstraints: highestAction === 'ROUTE' ? routingConstraints || {} : undefined
    };
  }
}

module.exports = {
  DecisionService,
  decisionService: new DecisionService(),
  DECISION_PRECEDENCE
};
