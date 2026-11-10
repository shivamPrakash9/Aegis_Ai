// Security Tests: SSRF Prevention, Protocol Validation, and Outbound Guardrails

const { validateProviderUrl } = require('../../src/utils/httpSecurity');
const { ForbiddenError, BadRequestError } = require('../../src/utils/errors');

describe('Outbound HTTP Security & SSRF Prevention', () => {
  test('allows requests to allowlisted provider hosts', () => {
    expect(() => validateProviderUrl('https://api.openai.com/v1/chat/completions')).not.toThrow();
    expect(() => validateProviderUrl('https://api.anthropic.com/v1/messages')).not.toThrow();
    expect(() => validateProviderUrl('https://generativelanguage.googleapis.com/v1beta/models')).not.toThrow();
    expect(() => validateProviderUrl('http://127.0.0.1:8080/v1')).not.toThrow();
    expect(() => validateProviderUrl('http://localhost:3000/v1')).not.toThrow();
  });

  test('SECURITY REQUIREMENT: blocks access to AWS/GCP cloud metadata endpoints', () => {
    expect(() => validateProviderUrl('http://169.254.169.254/latest/meta-data')).toThrow(ForbiddenError);
    expect(() => validateProviderUrl('http://metadata.google.internal/computeMetadata/v1')).toThrow(ForbiddenError);
  });

  test('SECURITY REQUIREMENT: blocks outbound requests to arbitrary unapproved hosts', () => {
    expect(() => validateProviderUrl('https://malicious-attacker.example.com/exfiltrate')).toThrow(ForbiddenError);
    expect(() => validateProviderUrl('https://evil-server.org/api')).toThrow(ForbiddenError);
  });

  test('SECURITY REQUIREMENT: blocks forbidden protocols (file, ftp, gopher)', () => {
    expect(() => validateProviderUrl('file:///etc/passwd')).toThrow(ForbiddenError);
    expect(() => validateProviderUrl('ftp://ftp.example.com/file')).toThrow(ForbiddenError);
    expect(() => validateProviderUrl('gopher://gopher.example.com')).toThrow(ForbiddenError);
  });

  test('rejects malformed URLs', () => {
    expect(() => validateProviderUrl('not-a-valid-url')).toThrow(BadRequestError);
  });
});
