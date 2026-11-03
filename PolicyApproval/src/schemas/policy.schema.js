// JSON Schemas for Policy & Approval Microservice Validation

const ruleConditionLeafSchema = {
  type: 'object',
  properties: {
    field: { type: 'string', minLength: 1 },
    operator: {
      type: 'string',
      enum: [
        'eq',
        'neq',
        'in',
        'notIn',
        'contains',
        'startsWith',
        'endsWith',
        'gt',
        'gte',
        'lt',
        'lte',
        'exists',
        'has_role'
      ]
    },
    value: {}
  },
  additionalProperties: true
};

const ruleSchema = {
  type: 'object',
  required: ['id', 'name', 'effect', 'condition', 'reason'],
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 64 },
    name: { type: 'string', minLength: 1, maxLength: 128 },
    effect: {
      type: 'string',
      enum: ['ALLOW', 'DENY', 'REQUIRE_APPROVAL']
    },
    priority: { type: 'integer', minimum: 1, maximum: 1000 },
    condition: { type: 'object' },
    reason: { type: 'string', minLength: 1, maxLength: 500 },
    reasonCode: { type: 'string', maxLength: 64 },
    requiredApprovers: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  additionalProperties: true
};

const evaluateSchema = {
  type: 'object',
  required: ['organizationId'],
  properties: {
    organizationId: { type: 'string', minLength: 1, maxLength: 128 },
    principal: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        role: { type: 'string' },
        type: { type: 'string' },
        organizationId: { type: 'string' }
      },
      additionalProperties: true
    },
    messages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          role: { type: 'string' },
          content: { type: 'string' }
        },
        additionalProperties: true
      }
    },
    modelPreference: {
      type: 'object',
      properties: {
        provider: { type: 'string' },
        model: { type: 'string' }
      },
      additionalProperties: true
    },
    context: {
      type: 'object',
      additionalProperties: true
    },
    metadata: {
      type: 'object',
      additionalProperties: true
    },
    requestId: { type: 'string' }
  },
  additionalProperties: true
};

const createPolicySchema = {
  type: 'object',
  required: ['name', 'rules'],
  properties: {
    organizationId: { type: 'string', minLength: 1, maxLength: 128 },
    name: { type: 'string', minLength: 1, maxLength: 128 },
    description: { type: 'string', maxLength: 500 },
    mode: {
      type: 'string',
      enum: ['ENFORCING', 'AUDIT_ONLY', 'DISABLED']
    },
    rules: {
      type: 'array',
      items: ruleSchema,
      minItems: 1,
      maxItems: 50
    }
  },
  additionalProperties: false
};

const updatePolicySchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 128 },
    description: { type: 'string', maxLength: 500 },
    mode: {
      type: 'string',
      enum: ['ENFORCING', 'AUDIT_ONLY', 'DISABLED']
    },
    rules: {
      type: 'array',
      items: ruleSchema,
      minItems: 1,
      maxItems: 50
    },
    isActive: { type: 'boolean' }
  },
  additionalProperties: false
};

const approvalDecisionSchema = {
  type: 'object',
  required: ['decision'],
  properties: {
    decision: {
      type: 'string',
      enum: ['APPROVED', 'REJECTED', 'APPROVE', 'REJECT']
    },
    reason: { type: 'string', maxLength: 1000 }
  },
  additionalProperties: false
};

const approvalQuerySchema = {
  type: 'object',
  properties: {
    page: { type: 'integer', minimum: 1 },
    limit: { type: 'integer', minimum: 1, maximum: 100 },
    status: {
      type: 'string',
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED']
    }
  },
  additionalProperties: true
};

module.exports = {
  evaluateSchema,
  createPolicySchema,
  updatePolicySchema,
  approvalDecisionSchema,
  approvalQuerySchema
};
