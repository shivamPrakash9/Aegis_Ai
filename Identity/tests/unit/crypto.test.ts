// Unit Tests: Cryptographic and Hashing Operations

import {
  generateCorrelationId,
  generateSecureToken,
  generateServiceAccountKey,
  hashPassword,
  hashSha256,
  parseAndVerifyApiKey,
  verifyPassword
} from '../../src/utils/crypto';

describe('Crypto Utilities', () => {
  describe('Argon2id Password Hashing', () => {
    it('should securely hash a password using Argon2id', async () => {
      const password = 'StrongPassword123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).toContain('$argon2id$');
    });

    it('should verify a correct password against hash', async () => {
      const password = 'SecureSecretPassword456#';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject an incorrect password', async () => {
      const password = 'CorrectPassword';
      const wrongPassword = 'WrongPassword';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(wrongPassword, hash);

      expect(isValid).toBe(false);
    });

    it('should safely handle corrupted or malformed hashes without crashing', async () => {
      const isValid = await verifyPassword('password', 'invalid_corrupted_hash');
      expect(isValid).toBe(false);
    });
  });

  describe('Service Account Key Generation & Verification', () => {
    it('should generate an API key with correct aegis_sa_ prefix and secret hash', () => {
      const { apiKey, keyPrefix, secretHash } = generateServiceAccountKey();

      expect(apiKey).toMatch(/^aegis_sa_[0-9a-f]{8}_[0-9a-f]{48}$/);
      expect(keyPrefix).toMatch(/^aegis_sa_[0-9a-f]{8}$/);
      expect(secretHash).toHaveLength(64); // SHA-256 hex string length
    });

    it('should successfully verify a valid generated API key against secret hash', () => {
      const { apiKey, secretHash } = generateServiceAccountKey();
      const isValid = parseAndVerifyApiKey(apiKey, secretHash);

      expect(isValid).toBe(true);
    });

    it('should reject a tampered API key', () => {
      const { apiKey, secretHash } = generateServiceAccountKey();
      const tamperedKey = apiKey.slice(0, -4) + 'abcd';
      const isValid = parseAndVerifyApiKey(tamperedKey, secretHash);

      expect(isValid).toBe(false);
    });

    it('should reject malformed API keys', () => {
      const { secretHash } = generateServiceAccountKey();
      expect(parseAndVerifyApiKey('invalid_key_string', secretHash)).toBe(false);
      expect(parseAndVerifyApiKey('', secretHash)).toBe(false);
    });
  });

  describe('Secure Tokens and Hashing', () => {
    it('should generate unpredictable random tokens', () => {
      const token1 = generateSecureToken(32);
      const token2 = generateSecureToken(32);

      expect(token1).toHaveLength(64);
      expect(token2).toHaveLength(64);
      expect(token1).not.toEqual(token2);
    });

    it('should produce consistent SHA-256 hashes', () => {
      const input = 'sample_refresh_token_payload';
      const hash1 = hashSha256(input);
      const hash2 = hashSha256(input);

      expect(hash1).toEqual(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('should generate valid UUID v4 correlation IDs', () => {
      const id = generateCorrelationId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });
  });
});
