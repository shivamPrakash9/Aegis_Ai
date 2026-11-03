// Unit Tests: OpenAI-Compatible Provider Adapter

const { OpenAiCompatibleProvider } = require('../../src/providers/openaiCompatible.provider');
const { BadGatewayError, ServiceUnavailableError } = require('../../src/utils/errors');

describe('OpenAI-Compatible Provider Adapter', () => {
  let provider;

  beforeEach(() => {
    provider = new OpenAiCompatibleProvider({
      apiKey: 'test-openai-key-12345',
      baseUrl: 'https://api.openai.com/v1'
    });
  });

  test('isConfigured reports true when API key is set', () => {
    expect(provider.isConfigured()).toBe(true);

    const unconfigured = new OpenAiCompatibleProvider({ apiKey: '' });
    expect(unconfigured.isConfigured()).toBe(false);
  });

  test('normalizeRequest formats messages, temperature, and tokens correctly', () => {
    const payload = provider.normalizeRequest({
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' }
      ],
      temperature: 0.8,
      maxTokens: 500,
      stop: ['\n']
    });

    expect(payload.model).toBe('gpt-4o');
    expect(payload.messages).toHaveLength(2);
    expect(payload.temperature).toBe(0.8);
    expect(payload.max_tokens).toBe(500);
    expect(payload.stop).toEqual(['\n']);
  });

  test('normalizeResponse maps OpenAI response to standard Gateway contract', () => {
    const rawOpenAiResponse = {
      id: 'chatcmpl-test-abc',
      object: 'chat.completion',
      created: 1729380000,
      model: 'gpt-4o-2024-08-06',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'Zero-trust requires verifying every request.'
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: 15,
        completion_tokens: 8,
        total_tokens: 23
      }
    };

    const normalized = provider.normalizeResponse(rawOpenAiResponse, 'gpt-4o');

    expect(normalized.id).toBe('chatcmpl-test-abc');
    expect(normalized.model).toBe('gpt-4o-2024-08-06');
    expect(normalized.provider).toBe('openai');
    expect(normalized.choices).toHaveLength(1);
    expect(normalized.choices[0].message.content).toBe('Zero-trust requires verifying every request.');
    expect(normalized.usage.promptTokens).toBe(15);
    expect(normalized.usage.completionTokens).toBe(8);
    expect(normalized.usage.totalTokens).toBe(23);
    expect(normalized.usage.prompt_tokens).toBe(15);
  });

  test('normalizeResponse throws BadGatewayError when response is missing choices', () => {
    expect(() => provider.normalizeResponse({}, 'gpt-4o')).toThrow(BadGatewayError);
    expect(() => provider.normalizeResponse({ choices: [] }, 'gpt-4o')).toThrow(BadGatewayError);
  });

  test('throws ServiceUnavailableError if invoked without configured credentials', async () => {
    const emptyProvider = new OpenAiCompatibleProvider({ apiKey: '' });

    await expect(
      emptyProvider.invokeCompletion({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }]
      })
    ).rejects.toThrow(ServiceUnavailableError);
  });
});
