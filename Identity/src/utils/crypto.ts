// Cryptographic Utilities: Argon2id Hashing, API Key Generation, and Token Hashing

import * as argon2 from 'argon2';
import * as crypto from 'crypto';

/**
 * Hash a plaintext password using Argon2id with OWASP-recommended parameters
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4
  });
}

/**
 * Verify a plaintext password against an Argon2id hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * Generate a cryptographically secure random token (hex)
 */
export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Compute a SHA-256 hash of a string (used for refresh token storage)
 */
export function hashSha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate a secure Machine API Key for Service Accounts
 * Pattern: aegis_live_<8_char_prefix>_<32_char_secret>
 * Returns the full API key (issued only once), the public prefix (for DB indexing), and the secret hash
 */
export function generateServiceAccountKey(): {
  apiKey: string;
  keyPrefix: string;
  secretHash: string;
} {
  const prefix = crypto.randomBytes(4).toString('hex'); // 8 hex chars
  const secret = crypto.randomBytes(24).toString('hex'); // 48 hex chars
  const keyPrefix = `aegis_sa_${prefix}`;
  const apiKey = `${keyPrefix}_${secret}`;
  const secretHash = hashSha256(secret);

  return { apiKey, keyPrefix, secretHash };
}

/**
 * Parse and verify a service account API key
 */
export function parseAndVerifyApiKey(
  apiKey: string,
  storedSecretHash: string
): boolean {
  try {
    const parts = apiKey.split('_');
    // Expected format: aegis_sa_<prefix>_<secret>
    if (parts.length < 4 || parts[0] !== 'aegis' || parts[1] !== 'sa') {
      return false;
    }
    const secret = parts[3];
    const computedHash = hashSha256(secret);
    return crypto.timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(storedSecretHash, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Generate a UUID v4 correlation ID
 */
export function generateCorrelationId(): string {
  return crypto.randomUUID();
}
