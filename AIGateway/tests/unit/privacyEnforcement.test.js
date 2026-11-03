// Unit Tests: Privacy and Policy Enforcement Logic

const { PrivacyEnforcementService } = require('../../src/services/privacyEnforcement.service');

describe('Privacy Enforcement Service', () => {
  let enforcer;

  beforeEach(() => {
    enforcer = new PrivacyEnforcementService();
  });

  describe('enforceScanAction', () => {
    it('should proceed with original messages on ALLOW', () => {
      const messages = [{ role: 'user', content: 'What is cloud computing?' }];
      const result = enforcer.enforceScanAction({
        action: 'ALLOW',
        originalMessages: messages
      });

      expect(result.proceedWithInvocation).toBe(true);
      expect(result.effectiveMessages).toEqual(messages);
    });

    it('should halt invocation and mark BLOCKED on BLOCK', () => {
      const messages = [{ role: 'user', content: 'Here is an internal password.' }];
      const result = enforcer.enforceScanAction({
        action: 'BLOCK',
        originalMessages: messages
      });

      expect(result.proceedWithInvocation).toBe(false);
      expect(result.finalStatus).toBe('BLOCKED');
      expect(result.reason).toContain('prohibited sensitive information');
    });

    it('should use sanitized messages on MASK', () => {
      const original = [{ role: 'user', content: 'Contact me at john@example.com' }];
      const sanitized = [{ role: 'user', content: 'Contact me at [EMAIL_REDACTED]' }];

      const result = enforcer.enforceScanAction({
        action: 'MASK',
        originalMessages: original,
        sanitizedMessages: sanitized
      });

      expect(result.proceedWithInvocation).toBe(true);
      expect(result.effectiveMessages).toEqual(sanitized);
    });

    it('SECURITY REGRESSION: should BLOCK and NEVER fallback to raw prompt if MASK produces empty sanitized messages', () => {
      const original = [{ role: 'user', content: 'Sensitive confidential prompt' }];

      const result = enforcer.enforceScanAction({
        action: 'MASK',
        originalMessages: original,
        sanitizedMessages: [] // Masking failed or omitted
      });

      expect(result.proceedWithInvocation).toBe(false);
      expect(result.finalStatus).toBe('BLOCKED');
      expect(result.effectiveMessages).toEqual([]);
    });

    it('should hold invocation and mark WAITING_FOR_APPROVAL on REQUIRE_APPROVAL', () => {
      const messages = [{ role: 'user', content: 'Financial quarterly preliminary figures.' }];
      const result = enforcer.enforceScanAction({
        action: 'REQUIRE_APPROVAL',
        originalMessages: messages
      });

      expect(result.proceedWithInvocation).toBe(false);
      expect(result.finalStatus).toBe('WAITING_FOR_APPROVAL');
    });

    it('should pass routing constraints on ROUTE', () => {
      const messages = [{ role: 'user', content: 'Code review this file.' }];
      const constraints = { allowedProviders: ['anthropic'], requiredCapabilities: ['code'] };

      const result = enforcer.enforceScanAction({
        action: 'ROUTE',
        originalMessages: messages,
        routingConstraints: constraints
      });

      expect(result.proceedWithInvocation).toBe(true);
      expect(result.routingConstraints).toEqual(constraints);
    });
  });

  describe('enforcePolicyDecision', () => {
    it('should proceed on ALLOW policy decision', () => {
      const result = enforcer.enforcePolicyDecision({ decision: 'ALLOW' });
      expect(result.proceedWithInvocation).toBe(true);
    });

    it('should block on DENY policy decision with reason', () => {
      const result = enforcer.enforcePolicyDecision({
        decision: 'DENY',
        violations: [{ rule: 'GEO_RESTRICTION', reason: 'Country not permitted' }]
      });

      expect(result.proceedWithInvocation).toBe(false);
      expect(result.finalStatus).toBe('BLOCKED');
      expect(result.reason).toContain('Country not permitted');
    });

    it('should set WAITING_FOR_APPROVAL on REQUIRE_APPROVAL policy decision', () => {
      const result = enforcer.enforcePolicyDecision({ decision: 'REQUIRE_APPROVAL' });
      expect(result.proceedWithInvocation).toBe(false);
      expect(result.finalStatus).toBe('WAITING_FOR_APPROVAL');
    });
  });
});
