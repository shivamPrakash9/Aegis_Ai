// Unit Tests: Google Gemini Provider Adapter

const { GeminiProvider } = require('../../src/providers/gemini.provider');
const { BadGatewayError, ServiceUnavailableError } = require('../../src/utils/errors');

describe('Google Gemini Provider Adapter', () => {
  let provider;

  beforeEach(() => {
    provider = new GeminiProvider({
      apiKey: 'test-gemini-key-12345',
      baseUrl: 'https://generativelanguage.googleapis.com',
      defaultModel: 'gemini-3.5-flash-lite'
    });
  });

  test('isConfigured reports true when API key is set', () => {
    expect(provider.isConfigured()).toBe(true);

    const unconfigured = new GeminiProvider({ apiKey: '' });
    expect(unconfigured.isConfigured()).toBe(false);
  });

  test('normalizeRequest extracts system instructions and formats contents', () => {
    const payload = provider.normalizeRequest({
      messages: [
        { role: 'system', content: 'You are an enterprise AI assistant.' },
        { role: 'user', content: 'Explain zero trust.' }
      ],
      temperature: 0.7,
      maxTokens: 2048,
      stop: ['STOP_SEQ']
    });

    expect(payload.systemInstruction).toBeDefined();
    expect(payload.systemInstruction.parts[0].text).toBe('You are an enterprise AI assistant.');
    expect(payload.contents).toHaveLength(1);
    expect(payload.contents[0].role).toBe('user');
    expect(payload.contents[0].parts[0].text).toBe('Explain zero trust.');
    expect(payload.generationConfig.temperature).toBe(0.7);
    expect(payload.generationConfig.maxOutputTokens).toBe(2048);
    expect(payload.generationConfig.stopSequences).toEqual(['STOP_SEQ']);
  });

  test('normalizeRequest merges consecutive messages with the same role', () => {
    const payload = provider.normalizeRequest({
      messages: [
        { role: 'user', content: 'First message.' },
        { role: 'user', content: 'Second message.' }
      ]
    });

    expect(payload.contents).toHaveLength(1);
    expect(payload.contents[0].role).toBe('user');
    expect(payload.contents[0].parts).toHaveLength(2);
    expect(payload.contents[0].parts[0].text).toBe('First message.');
    expect(payload.contents[0].parts[1].text).toBe('Second message.');
  });

  test('normalizeResponse maps Gemini candidate format to standard choices & usage format', () => {
    const rawGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              { text: 'Zero trust is a security model requiring continuous verification.' }
            ],
            role: 'model'
          },
          finishReason: 'STOP',
          index: 0
        }
      ],
      usageMetadata: {
        promptTokenCount: 25,
        candidatesTokenCount: 15,
        totalTokenCount: 40
      }
    };

    const normalized = provider.normalizeResponse(rawGeminiResponse, 'gemini-3.5-flash-lite');

    expect(normalized.id).toContain('chatcmpl_gemini_');
    expect(normalized.model).toBe('gemini-3.5-flash-lite');
    expect(normalized.provider).toBe('gemini');
    expect(normalized.choices).toHaveLength(1);
    expect(normalized.choices[0].message.content).toBe(
      'Zero trust is a security model requiring continuous verification.'
    );
    expect(normalized.choices[0].finish_reason).toBe('stop');
    expect(normalized.usage.promptTokens).toBe(25);
    expect(normalized.usage.completionTokens).toBe(15);
    expect(normalized.usage.totalTokens).toBe(40);
  });

  test('normalizeResponse handles empty or malformed response', () => {
    expect(() => provider.normalizeResponse(null, 'gemini-3.5-flash-lite')).toThrow(BadGatewayError);
  });

  test('throws ServiceUnavailableError if invoked without configured credentials', async () => {
    const emptyProvider = new GeminiProvider({ apiKey: '' });

    await expect(
      emptyProvider.invokeCompletion({
        model: 'gemini-3.5-flash-lite',
        messages: [{ role: 'user', content: 'Hello' }]
      })
    ).rejects.toThrow(ServiceUnavailableError);
  });
});

