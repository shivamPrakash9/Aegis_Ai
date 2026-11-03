// Unit Tests: Anthropic Claude Provider Adapter

const { AnthropicProvider } = require('../../src/providers/anthropic.provider');
const { BadGatewayError, ServiceUnavailableError } = require('../../src/utils/errors');

describe('Anthropic Claude Provider Adapter', () => {
  let provider;

  beforeEach(() => {
    provider = new AnthropicProvider({
      apiKey: 'test-anthropic-key-67890',
      baseUrl: 'https://api.anthropic.com'
    });
  });

  test('isConfigured reports true when API key is set', () => {
    expect(provider.isConfigured()).toBe(true);

    const unconfigured = new AnthropicProvider({ apiKey: '' });
    expect(unconfigured.isConfigured()).toBe(false);
  });

  test('normalizeRequest extracts system role to top-level system parameter and sets max_tokens', () => {
    const payload = provider.normalizeRequest({
      model: 'claude-3-5-sonnet',
      messages: [
        { role: 'system', content: 'You are a cybersecurity expert.' },
        { role: 'user', content: 'Audit this policy.' }
      ],
      temperature: 0.5,
      maxTokens: 2000
    });

    expect(payload.model).toBe('claude-3-5-sonnet');
    expect(payload.system).toBe('You are a cybersecurity expert.');
    expect(payload.messages).toHaveLength(1);
    expect(payload.messages[0]).toEqual({ role: 'user', content: 'Audit this policy.' });
    expect(payload.max_tokens).toBe(2000);
    expect(payload.temperature).toBe(0.5);
  });

  test('normalizeResponse maps Anthropic block format to standard choices & usage format', () => {
    const rawAnthropicResponse = {
      id: 'msg_01XyZ999',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'The architecture satisfies enterprise least-privilege requirements.'
        }
      ],
      model: 'claude-3-5-sonnet-20240620',
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 30,
        output_tokens: 12
      }
    };

    const normalized = provider.normalizeResponse(rawAnthropicResponse, 'claude-3-5-sonnet');

    expect(normalized.id).toBe('msg_01XyZ999');
    expect(normalized.model).toBe('claude-3-5-sonnet-20240620');
    expect(normalized.provider).toBe('anthropic');
    expect(normalized.choices).toHaveLength(1);
    expect(normalized.choices[0].message.content).toBe(
      'The architecture satisfies enterprise least-privilege requirements.'
    );
    expect(normalized.choices[0].finish_reason).toBe('stop');
    expect(normalized.usage.promptTokens).toBe(30);
    expect(normalized.usage.completionTokens).toBe(12);
    expect(normalized.usage.totalTokens).toBe(42);
  });

  test('normalizeResponse handles empty or malformed response', () => {
    expect(() => provider.normalizeResponse(null, 'claude-3-5-sonnet')).toThrow(BadGatewayError);
  });

  test('throws ServiceUnavailableError if invoked without configured credentials', async () => {
    const emptyProvider = new AnthropicProvider({ apiKey: '' });

    await expect(
      emptyProvider.invokeCompletion({
        model: 'claude-3-5-sonnet',
        messages: [{ role: 'user', content: 'Hello' }]
      })
    ).rejects.toThrow(ServiceUnavailableError);
  });
});
