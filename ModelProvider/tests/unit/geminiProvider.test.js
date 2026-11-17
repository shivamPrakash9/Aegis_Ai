const { GeminiProvider } = require('../../src/providers/gemini.provider');
const { ServiceUnavailableError, BadGatewayError } = require('../../src/utils/errors');

describe('Google Gemini Provider Adapter', () => {
  test('isConfigured reports true when API key is set', () => {
    const p1 = new GeminiProvider({ apiKey: '' });
    expect(p1.isConfigured()).toBe(false);

    const p2 = new GeminiProvider({ apiKey: 'AIzaSyFakeKey123' });
    expect(p2.isConfigured()).toBe(true);
  });

  test('normalizeRequest formats messages, system instruction, and parameters correctly', () => {
    const p = new GeminiProvider({ apiKey: 'fake-key' });
    const payload = p.normalizeRequest({
      model: 'gemini-1.5-flash',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' }
      ],
      temperature: 0.8,
      maxTokens: 2048,
      stop: ['STOP_TOKEN']
    });

    expect(payload.systemInstruction).toEqual({
      parts: [{ text: 'You are a helpful assistant.' }]
    });

    expect(payload.contents).toEqual([
      { role: 'user', parts: [{ text: 'Hello' }] },
      { role: 'model', parts: [{ text: 'Hi there!' }] },
      { role: 'user', parts: [{ text: 'How are you?' }] }
    ]);

    expect(payload.generationConfig.temperature).toBe(0.8);
    expect(payload.generationConfig.maxOutputTokens).toBe(2048);
    expect(payload.generationConfig.stopSequences).toEqual(['STOP_TOKEN']);
  });

  test('normalizeResponse maps Gemini candidate structure to standard choices & usage format', () => {
    const p = new GeminiProvider({ apiKey: 'fake-key' });
    const raw = {
      candidates: [
        {
          content: {
            parts: [{ text: 'AegisAI is an enterprise AI governance gateway.' }]
          },
          finishReason: 'STOP'
        }
      ],
      usageMetadata: {
        promptTokenCount: 15,
        candidatesTokenCount: 25,
        totalTokenCount: 40
      }
    };

    const res = p.normalizeResponse(raw, 'gemini-1.5-flash');
    expect(res.choices[0].message.content).toBe('AegisAI is an enterprise AI governance gateway.');
    expect(res.choices[0].finish_reason).toBe('stop');
    expect(res.usage.totalTokens).toBe(40);
    expect(res.provider).toBe('gemini');
  });

  test('normalizeResponse throws BadGatewayError on empty response or blocked prompt', () => {
    const p = new GeminiProvider({ apiKey: 'fake-key' });
    expect(() => p.normalizeResponse(null, 'gemini-1.5-flash')).toThrow(BadGatewayError);
    expect(() => p.normalizeResponse({ promptFeedback: { blockReason: 'SAFETY' } }, 'gemini-1.5-flash')).toThrow(BadGatewayError);
  });

  test('throws ServiceUnavailableError if invoked without credentials in test mode', async () => {
    const p = new GeminiProvider({ apiKey: '' });
    await expect(
      p.invokeCompletion({
        model: 'gemini-1.5-flash',
        messages: [{ role: 'user', content: 'Hello' }]
      })
    ).rejects.toThrow(ServiceUnavailableError);
  });
});
