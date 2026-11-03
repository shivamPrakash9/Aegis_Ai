// Unit Tests for Event Sanitization Service

const { eventSanitizationService } = require('../../src/services/eventSanitization.service');

describe('Event Sanitization Service', () => {
  it('strips or redacts sensitive keys: prompt, completion, password, apiKey, token', () => {
    const rawEvent = {
      eventType: 'AI_REQUEST_COMPLETED',
      details: {
        model: 'gpt-4o',
        prompt: 'How to bypass security?',
        rawPrompt: 'Secret prompt content',
        completion: 'This is the model response',
        apiKey: 'sk-proj-supersecret12345',
        password: 'admin_password!',
        token: 'eyJh...jwt_token',
        nested: {
          refreshToken: 'refresh_secret',
          safeField: 'allowed_value'
        }
      }
    };

    const sanitized = eventSanitizationService.sanitizeEvent(rawEvent);

    expect(sanitized.details.prompt).toBe('[REDACTED_SENSITIVE_DATA]');
    expect(sanitized.details.rawPrompt).toBe('[REDACTED_SENSITIVE_DATA]');
    expect(sanitized.details.completion).toBe('[REDACTED_SENSITIVE_DATA]');
    expect(sanitized.details.apiKey).toBe('[REDACTED_SENSITIVE_DATA]');
    expect(sanitized.details.password).toBe('[REDACTED_SENSITIVE_DATA]');
    expect(sanitized.details.token).toBe('[REDACTED_SENSITIVE_DATA]');
    expect(sanitized.details.nested.refreshToken).toBe('[REDACTED_SENSITIVE_DATA]');
    expect(sanitized.details.nested.safeField).toBe('allowed_value');
    expect(sanitized.details.model).toBe('gpt-4o');
  });

  it('redacts tokens and passwords inside error strings', () => {
    const rawEvent = {
      eventType: 'MODEL_INVOCATION_FAILED',
      errorMessage: 'Provider call failed with Bearer secret-token-12345 and apiKey=my_api_key_secret'
    };

    const sanitized = eventSanitizationService.sanitizeEvent(rawEvent);

    expect(sanitized.errorMessage).toContain('Bearer [REDACTED]');
    expect(sanitized.errorMessage).toContain('apiKey=[REDACTED]');
    expect(sanitized.errorMessage).not.toContain('secret-token-12345');
    expect(sanitized.errorMessage).not.toContain('my_api_key_secret');
  });

  it('bounds recursion depth to prevent stack overflow', () => {
    let deepObj = { level: 10 };
    for (let i = 0; i < 15; i++) {
      deepObj = { child: deepObj };
    }

    const sanitized = eventSanitizationService.sanitizeMetadata(deepObj);
    expect(JSON.stringify(sanitized)).toContain('[TRUNCATED_DEPTH_EXCEEDED]');
  });

  it('truncates oversized strings in metadata', () => {
    const longString = 'a'.repeat(3000);
    const sanitized = eventSanitizationService.sanitizeMetadata({ bigText: longString });

    expect(sanitized.bigText.length).toBeLessThan(2100);
    expect(sanitized.bigText).toContain('[TRUNCATED]');
  });

  it('prevents prototype pollution properties', () => {
    const malicious = JSON.parse('{"__proto__": {"polluted": true}, "safe": 123}');
    const sanitized = eventSanitizationService.sanitizeMetadata(malicious);

    expect(sanitized.polluted).toBeUndefined();
    expect(sanitized.safe).toBe(123);
  });
});
