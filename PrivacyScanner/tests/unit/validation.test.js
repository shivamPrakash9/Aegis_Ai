// Unit Tests: Schema Validation

const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const { scanRequestSchema, scanIdParamSchema } = require('../../src/schemas/scan.schema');

describe('Schema Validation Unit Tests', () => {
  let ajv;
  let scanValidator;
  let scanIdValidator;

  beforeEach(() => {
    ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    scanValidator = ajv.compile(scanRequestSchema);
    scanIdValidator = ajv.compile(scanIdParamSchema);
  });

  it('should validate valid Gateway scan request payload', () => {
    const validPayload = {
      organizationId: 'org_123',
      messages: [
        { role: 'user', content: 'Hello there' }
      ]
    };

    const valid = scanValidator(validPayload);
    expect(valid).toBe(true);
  });

  it('should validate valid extended content.messages payload', () => {
    const validExtendedPayload = {
      requestId: 'req_123',
      organizationId: 'org_123',
      content: {
        messages: [
          { role: 'user', content: 'Analyze this data' }
        ]
      },
      mode: 'MASK'
    };

    const valid = scanValidator(validExtendedPayload);
    expect(valid).toBe(true);
  });

  it('should reject payload missing organizationId', () => {
    const invalid = {
      messages: [{ role: 'user', content: 'Hello' }]
    };

    expect(scanValidator(invalid)).toBe(false);
  });

  it('should reject payload with empty messages array', () => {
    const invalid = {
      organizationId: 'org_123',
      messages: []
    };

    expect(scanValidator(invalid)).toBe(false);
  });

  it('should reject payload with invalid role enum', () => {
    const invalid = {
      organizationId: 'org_123',
      messages: [{ role: 'hacker', content: 'Testing' }]
    };

    expect(scanValidator(invalid)).toBe(false);
  });

  it('should validate scanId parameter schema', () => {
    expect(scanIdValidator({ scanId: 'scan_123' })).toBe(true);
    expect(scanIdValidator({ scanId: '' })).toBe(false);
  });
});
