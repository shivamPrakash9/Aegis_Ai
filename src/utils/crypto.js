// AES-256-GCM Encryption Utility for Model Provider Secrets at Rest

const crypto = require('crypto');
const { env } = require('../config/env');

const ALGORITHM = 'aes-256-gcm';

function getDerivedKey() {
  const secret = env.encryptionKey || env.modelJwtSecret || 'aegis_default_secret_encryption_key_32_chars';
  return crypto.createHash('sha256').update(String(secret)).digest();
}

/**
 * Encrypts a plaintext secret into an authenticated ciphertext string.
 * Format: enc:iv:authTag:ciphertext
 *
 * @param {string} plaintext
 * @returns {string|null}
 */
function encryptSecret(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') return null;
  try {
    const key = getDerivedKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `enc:${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch {
    return plaintext;
  }
}

/**
 * Decrypts an authenticated ciphertext string back into plaintext.
 * Handles legacy unencrypted strings gracefully.
 *
 * @param {string} ciphertext
 * @returns {string|null}
 */
function decryptSecret(ciphertext) {
  if (!ciphertext || typeof ciphertext !== 'string') return null;
  if (!ciphertext.startsWith('enc:')) {
    // Unencrypted legacy key
    return ciphertext;
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 4) {
    return ciphertext;
  }

  const [, ivHex, authTagHex, encryptedHex] = parts;
  try {
    const key = getDerivedKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

module.exports = {
  encryptSecret,
  decryptSecret
};
