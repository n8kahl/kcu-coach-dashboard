// ============================================
// Token Encryption Utility
// ============================================
// Encrypts social media access tokens before storing in database

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// Encryption settings
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

/**
 * Get or generate the encryption key from environment
 * Uses SESSION_SECRET as the base for deriving the key
 */
function getEncryptionKey(salt: Buffer): Buffer {
  const secret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!secret || secret.length < 32) {
    throw new Error('Encryption requires SESSION_SECRET to be at least 32 characters');
  }

  // Derive a key using scrypt (memory-hard KDF)
  return scryptSync(secret, salt, KEY_LENGTH);
}

/**
 * Encrypt a token for secure storage
 * Returns a base64-encoded string containing salt, IV, auth tag, and ciphertext
 */
export function encryptToken(plaintext: string): string {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty token');
  }

  // Generate random salt and IV
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);

  // Derive key from secret + salt
  const key = getEncryptionKey(salt);

  // Create cipher and encrypt
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  // Get auth tag for integrity verification
  const authTag = cipher.getAuthTag();

  // Combine: salt + iv + authTag + ciphertext
  const combined = Buffer.concat([salt, iv, authTag, encrypted]);

  return combined.toString('base64');
}

/**
 * Decrypt a token from storage
 * Expects the base64-encoded format from encryptToken
 */
export function decryptToken(encryptedBase64: string): string {
  if (!encryptedBase64) {
    throw new Error('Cannot decrypt empty token');
  }

  // Decode from base64
  const combined = Buffer.from(encryptedBase64, 'base64');

  // Extract components
  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  // Derive key from secret + salt
  const key = getEncryptionKey(salt);

  // Create decipher and decrypt
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Check if a string appears to be an encrypted token
 * (base64 encoded with minimum expected length)
 */
export function isEncryptedToken(token: string): boolean {
  if (!token) return false;

  try {
    const decoded = Buffer.from(token, 'base64');
    // Minimum length: salt + iv + authTag + at least 1 byte of data
    return decoded.length >= SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH + 1;
  } catch {
    return false;
  }
}
