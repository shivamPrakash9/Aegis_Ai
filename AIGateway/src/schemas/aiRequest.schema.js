// AJV Validation Schemas for AI Gateway APIs

const createAiRequestSchema = {
  type: 'object',
  required: ['messages'],
  additionalProperties: false,
  properties: {
    messages: {
      type: 'array',
      minItems: 1,
      maxItems: 50,
      items: {
        type: 'object',
        required: ['role', 'content'],
        additionalProperties: false,
        properties: {
          role: {
            type: 'string',
            enum: ['system', 'user', 'assistant']
          },
          content: {
            type: 'string',
            minLength: 1,
            maxLength: 100000
          }
        }
      }
    },
    modelPreference: {
      type: 'object',
      additionalProperties: false,
      properties: {
        capability: {
          type: 'string',
          enum: ['general', 'code', 'analysis', 'creative', 'embedding']
        },
        provider: {
          type: 'string',
          minLength: 1,
          maxLength: 64
        },
        model: {
          type: 'string',
          minLength: 1,
          maxLength: 128
        }
      }
    },
    metadata: {
      type: 'object',
      additionalProperties: true
    }
  }
};

const listAiRequestsQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: {
      type: 'string',
      enum: ['ACCEPTED', 'PROCESSING', 'WAITING_FOR_APPROVAL', 'COMPLETED', 'BLOCKED', 'FAILED']
    },
    page: {
      type: 'integer',
      minimum: 1,
      default: 1
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 20
    },
    startDate: {
      type: 'string',
      format: 'date-time'
    },
    endDate: {
      type: 'string',
      format: 'date-time'
    }
  }
};

const requestIdParamSchema = {
  type: 'object',
  required: ['id'],
  additionalProperties: false,
  properties: {
    id: {
      type: 'string',
      minLength: 5,
      maxLength: 64
    }
  }
};

module.exports = {
  createAiRequestSchema,
  listAiRequestsQuerySchema,
  requestIdParamSchema
};
