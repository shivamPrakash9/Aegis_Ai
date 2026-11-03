// Unit Tests: AJV Validation Schemas

import {
  ajv,
  createOrganizationSchema,
  createServiceAccountSchema,
  createUserSchema,
  loginSchema,
  verifySessionSchema
} from '../../src/schemas';

describe('Schema Validations', () => {
  describe('loginSchema', () => {
    const validate = ajv.compile(loginSchema);

    it('should pass with valid email and password', () => {
      const valid = validate({ email: 'user@example.com', password: 'ValidPassword123' });
      expect(valid).toBe(true);
    });

    it('should fail with invalid email format', () => {
      const valid = validate({ email: 'not-an-email', password: 'ValidPassword123' });
      expect(valid).toBe(false);
    });

    it('should fail when password is shorter than 8 characters', () => {
      const valid = validate({ email: 'user@example.com', password: 'short' });
      expect(valid).toBe(false);
    });
  });

  describe('createOrganizationSchema', () => {
    const validate = ajv.compile(createOrganizationSchema);

    it('should pass with valid name and slug', () => {
      const valid = validate({ name: 'Acme AI', slug: 'acme-ai' });
      expect(valid).toBe(true);
    });

    it('should reject invalid slug with spaces or uppercase or special characters', () => {
      expect(validate({ name: 'Acme AI', slug: 'Acme Slug' })).toBe(false);
      expect(validate({ name: 'Acme AI', slug: 'acme_slug' })).toBe(false);
      expect(validate({ name: 'Acme AI', slug: '-invalid-slug' })).toBe(false);
    });
  });

  describe('createUserSchema', () => {
    const validate = ajv.compile(createUserSchema);

    it('should accept valid user payload', () => {
      const valid = validate({
        email: 'dev@company.com',
        password: 'Password123!',
        displayName: 'Dev Engineer',
        role: 'DEVELOPER'
      });
      expect(valid).toBe(true);
    });

    it('should reject invalid role enum', () => {
      const valid = validate({
        email: 'dev@company.com',
        password: 'Password123!',
        displayName: 'Dev Engineer',
        role: 'SUPER_ADMIN' as any
      });
      expect(valid).toBe(false);
    });
  });

  describe('createServiceAccountSchema', () => {
    const validate = ajv.compile(createServiceAccountSchema);

    it('should accept valid service account payload', () => {
      const valid = validate({
        name: 'gateway-bot',
        permissions: ['organization:read', 'users:read']
      });
      expect(valid).toBe(true);
    });

    it('should reject unsupported permission string', () => {
      const valid = validate({
        name: 'gateway-bot',
        permissions: ['unsupported:permission']
      });
      expect(valid).toBe(false);
    });

    it('should reject empty permissions array', () => {
      const valid = validate({
        name: 'gateway-bot',
        permissions: []
      });
      expect(valid).toBe(false);
    });
  });

  describe('verifySessionSchema', () => {
    const validate = ajv.compile(verifySessionSchema);

    it('should accept token of adequate length', () => {
      const valid = validate({ token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' });
      expect(valid).toBe(true);
    });

    it('should reject empty or missing token', () => {
      expect(validate({ token: '' })).toBe(false);
      expect(validate({})).toBe(false);
    });
  });
});
