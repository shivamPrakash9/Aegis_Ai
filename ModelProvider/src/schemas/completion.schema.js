// JSON Schemas for Model & Provider Microservice Request Validation

const messageItemSchema = {
  type: 'object',
  required: ['role', 'content'],
  properties: {
    role: {
      type: 'string',
      enum: ['user', 'assistant', 'system', 'developer', 'tool']
    },
    content: {
      type: 'string',
      minLength: 1,
      maxLength: 50000
    }
  },
  additionalProperties: true
};

const createCompletionSchema = {
  type: 'object',
  required: ['messages', 'organizationId'],
  properties: {
    organizationId: {
      type: 'string',
      minLength: 1,
      maxLength: 128
    },
    messages: {
      type: 'array',
      items: messageItemSchema,
      minItems: 1,
      maxItems: 100
    },
    model: {
      type: 'string',
      minLength: 1,
      maxLength: 128
    },
    modelPreference: {
      type: 'object',
      properties: {
        provider: { type: 'string' },
        model: { type: 'string' }
      },
      additionalProperties: true
    },
    routingConstraints: {
      type: 'object',
      properties: {
        allowedProviders: {
          type: 'array',
          items: { type: 'string' }
        }
      },
      additionalProperties: true
    },
    temperature: {
      type: 'number',
      minimum: 0,
      maximum: 2
    },
    max_tokens: {
      type: 'integer',
      minimum: 1,
      maximum: 32768
    },
    maxTokens: {
      type: 'integer',
      minimum: 1,
      maximum: 32768
    },
    stop: {
      oneOf: [
        { type: 'string' },
        { type: 'array', items: { type: 'string' } }
      ]
    },
    requestId: { type: 'string' },
    traceId: { type: 'string' },
    callerId: { type: 'string' },
    metadata: { type: 'object' }
  },
  additionalProperties: true
};

const registerModelSchema = {
  type: 'object',
  required: ['modelId', 'provider'],
  properties: {
    modelId: { type: 'string', minLength: 1, maxLength: 64 },
    provider: { type: 'string', minLength: 1, maxLength: 64 },
    providerModelName: { type: 'string', maxLength: 128 },
    enabled: { type: 'boolean' },
    isDefault: { type: 'boolean' },
    maxTokens: { type: 'integer', minimum: 1, maximum: 128000 },
    contextWindow: { type: 'integer', minimum: 1000 },
    defaultTemperature: { type: 'number', minimum: 0, maximum: 2 },
    capabilities: {
      type: 'array',
      items: { type: 'string' }
    },
    description: { type: 'string', maxLength: 500 }
  },
  additionalProperties: false
};

const usageQuerySchema = {
  type: 'object',
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 100 },
    offset: { type: 'integer', minimum: 0 },
    model: { type: 'string' },
    provider: { type: 'string' }
  },
  additionalProperties: true
};

const registerProviderSchema = {
  type: 'object',
  required: ['id', 'name', 'type'],
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 64, pattern: '^[a-zA-Z0-9-_]+$' },
    name: { type: 'string', minLength: 1, maxLength: 128 },
    type: { type: 'string', enum: ['openai', 'anthropic', 'mock', 'custom'] },
    baseUrl: { type: 'string', maxLength: 512 },
    apiKey: { type: 'string', maxLength: 512 },
    enabled: { type: 'boolean' }
  },
  additionalProperties: false
};

module.exports = {
  createCompletionSchema,
  registerModelSchema,
  registerProviderSchema,
  usageQuerySchema
};
