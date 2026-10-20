// JSON Schemas for Privacy Scanner API Validation

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

const scanRequestSchema = {
  type: 'object',
  required: ['organizationId'],
  properties: {
    organizationId: {
      type: 'string',
      minLength: 1,
      maxLength: 128
    },
    requestId: {
      type: 'string',
      minLength: 1,
      maxLength: 128
    },
    mode: {
      type: 'string',
      enum: ['MASK', 'BLOCK', 'AUDIT', 'ALLOW']
    },
    messages: {
      type: 'array',
      items: messageItemSchema,
      minItems: 1,
      maxItems: 100
    },
    content: {
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          items: messageItemSchema,
          minItems: 1,
          maxItems: 100
        }
      },
      additionalProperties: true
    },
    text: {
      type: 'string',
      minLength: 1,
      maxLength: 50000
    }
  },
  anyOf: [
    { required: ['messages'] },
    { required: ['content'] },
    { required: ['text'] }
  ],
  additionalProperties: true
};

const scanIdParamSchema = {
  type: 'object',
  required: ['scanId'],
  properties: {
    scanId: {
      type: 'string',
      minLength: 1,
      maxLength: 128
    }
  },
  additionalProperties: false
};

const updateConfigSchema = {
  type: 'object',
  properties: {
    organizationId: {
      type: 'string',
      minLength: 1,
      maxLength: 128
    },
    enabledCategories: {
      type: 'array',
      items: { type: 'string' }
    },
    maskingConfiguration: {
      type: 'object'
    },
    ruleSetVersion: {
      type: 'string',
      maxLength: 32
    },
    status: {
      type: 'string',
      enum: ['ACTIVE', 'INACTIVE']
    }
  },
  additionalProperties: false
};

const addCustomPatternSchema = {
  type: 'object',
  required: ['name', 'pattern'],
  properties: {
    organizationId: {
      type: 'string',
      minLength: 1,
      maxLength: 128
    },
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 100
    },
    pattern: {
      type: 'string',
      minLength: 1,
      maxLength: 300
    },
    category: {
      type: 'string',
      maxLength: 50
    },
    severity: {
      type: 'string',
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
    },
    action: {
      type: 'string',
      enum: ['BLOCK', 'MASK', 'REQUIRE_APPROVAL', 'ROUTE', 'ALLOW']
    },
    replacement: {
      type: 'string',
      maxLength: 50
    },
    enabled: {
      type: 'boolean'
    }
  },
  additionalProperties: false
};

module.exports = {
  scanRequestSchema,
  scanIdParamSchema,
  updateConfigSchema,
  addCustomPatternSchema
};
