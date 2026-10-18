// Unit Tests: Request Schema Validation

const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const {
  createAiRequestSchema,
  listAiRequestsQuerySchema,
  requestIdParamSchema
} = require('../../src/schemas/aiRequest.schema');

describe('AI Request Schema Validation', () => {
  let ajv;

  beforeAll(() => {
    ajv = new Ajv({ allErrors: true, coerceTypes: true });
    addFormats(ajv);
  });

  describe('createAiRequestSchema', () => {
    let validate;

    beforeAll(() => {
      validate = ajv.compile(createAiRequestSchema);
    });

    it('should validate a correct AI request payload', () => {
      const validPayload = {
        messages: [
          { role: 'user', content: 'What is database normalization?' }
        ],
        modelPreference: {
          capability: 'general'
        },
        metadata: {
          client: 'test-runner'
        }
      };

      const valid = validate(validPayload);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should reject a payload without messages', () => {
      const payload = {
        modelPreference: { capability: 'general' }
      };

      const valid = validate(payload);
      expect(valid).toBe(false);
      expect(validate.errors[0].params.missingProperty).toBe('messages');
    });

    it('should reject empty messages array', () => {
      const payload = {
        messages: []
      };

      const valid = validate(payload);
      expect(valid).toBe(false);
    });

    it('should reject invalid role enum', () => {
      const payload = {
        messages: [
          { role: 'moderator', content: 'Hello' }
        ]
      };

      const valid = validate(payload);
      expect(valid).toBe(false);
    });

    it('should reject message with empty content string', () => {
      const payload = {
        messages: [
          { role: 'user', content: '' }
        ]
      };

      const valid = validate(payload);
      expect(valid).toBe(false);
    });
  });

  describe('listAiRequestsQuerySchema', () => {
    let validate;

    beforeAll(() => {
      validate = ajv.compile(listAiRequestsQuerySchema);
    });

    it('should validate correct pagination and filter params', () => {
      const query = {
        status: 'COMPLETED',
        page: 2,
        limit: 50,
        startDate: '2026-10-01T00:00:00Z'
      };

      const valid = validate(query);
      expect(valid).toBe(true);
    });

    it('should reject invalid status filter', () => {
      const query = { status: 'INVALID_STATUS' };
      const valid = validate(query);
      expect(valid).toBe(false);
    });
  });

  describe('requestIdParamSchema', () => {
    let validate;

    beforeAll(() => {
      validate = ajv.compile(requestIdParamSchema);
    });

    it('should accept valid request ID', () => {
      expect(validate({ id: 'req_1234567890abcdef' })).toBe(true);
    });

    it('should reject too short request ID', () => {
      expect(validate({ id: 'req' })).toBe(false);
    });
  });
});
