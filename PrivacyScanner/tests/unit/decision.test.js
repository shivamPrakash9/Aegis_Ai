// Unit Tests: Privacy Decision Evaluation Logic

const { DecisionService } = require('../../src/services/decision.service');

describe('Decision Service Unit Tests', () => {
  let decisionService;

  beforeEach(() => {
    decisionService = new DecisionService();
  });

  it('should return ALLOW when no findings are detected', () => {
    const result = decisionService.evaluateDecision({ findings: [] });
    expect(result.action).toBe('ALLOW');
    expect(result.decision).toBe('ALLOW');
  });

  it('should return MASK when PII entities (e.g. Email/Phone) are detected', () => {
    const findings = [
      { category: 'EMAIL', severity: 'MEDIUM', defaultAction: 'MASK' },
      { category: 'PHONE', severity: 'MEDIUM', defaultAction: 'MASK' }
    ];

    const result = decisionService.evaluateDecision({ findings, mode: 'MASK' });
    expect(result.action).toBe('MASK');
    expect(result.decision).toBe('MASK');
  });

  it('SECURITY REQUIREMENT: SECRET finding triggers non-negotiable BLOCK decision', () => {
    const findings = [
      { category: 'EMAIL', severity: 'MEDIUM', defaultAction: 'MASK' },
      { category: 'SECRET', severity: 'CRITICAL', defaultAction: 'BLOCK' }
    ];

    const result = decisionService.evaluateDecision({ findings });
    expect(result.action).toBe('BLOCK');
    expect(result.decision).toBe('BLOCK');
  });

  it('SECURITY REQUIREMENT: BLOCK is never downgraded to MASK when both exist', () => {
    const findings = [
      { category: 'SECRET', severity: 'CRITICAL', defaultAction: 'BLOCK' },
      { category: 'EMAIL', severity: 'MEDIUM', defaultAction: 'MASK' },
      { category: 'PHONE', severity: 'MEDIUM', defaultAction: 'MASK' }
    ];

    const result = decisionService.evaluateDecision({ findings, mode: 'MASK' });
    expect(result.action).toBe('BLOCK');
  });

  it('should return REQUIRE_APPROVAL when custom rule specifies human approval', () => {
    const findings = [
      { category: 'CONFIDENTIAL_DATA', severity: 'HIGH', defaultAction: 'REQUIRE_APPROVAL' }
    ];

    const result = decisionService.evaluateDecision({ findings });
    expect(result.action).toBe('REQUIRE_APPROVAL');
  });

  it('SECURITY REQUIREMENT: BLOCK takes precedence over REQUIRE_APPROVAL', () => {
    const findings = [
      { category: 'CONFIDENTIAL_DATA', severity: 'HIGH', defaultAction: 'REQUIRE_APPROVAL' },
      { category: 'SECRET', severity: 'CRITICAL', defaultAction: 'BLOCK' }
    ];

    const result = decisionService.evaluateDecision({ findings });
    expect(result.action).toBe('BLOCK');
  });

  it('SECURITY REQUIREMENT: should fail closed with BLOCK if masking failed', () => {
    const findings = [
      { category: 'EMAIL', severity: 'MEDIUM', defaultAction: 'MASK' }
    ];

    const result = decisionService.evaluateDecision({
      findings,
      maskingSucceeded: false // Simulation of masking failure
    });

    expect(result.action).toBe('BLOCK');
    expect(result.reason).toContain('Masking transformation could not be verified safely');
  });
});
