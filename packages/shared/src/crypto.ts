/**
 * Encryption utility for sensitive data (Git credentials, etc.)
 * Uses AES-256-GCM for authenticated encryption
 */

import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Derive a 256-bit key from a passphrase
 */
function deriveKey(passphrase: string): Buffer {
  // Use a fixed salt for deterministic key derivation
  // In production, consider using a random salt stored alongside
  const salt = Buffer.from('codegraph-cloud-salt-v1', 'utf-8');
  return crypto.pbkdf2Sync(passphrase, salt, 100000, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt a plaintext string
 * Returns: iv:tag:encrypted (all hex-encoded, colon-separated)
 */
export function encrypt(plaintext: string, passphrase: string): string {
  const key = deriveKey(passphrase);
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an encrypted string
 * Input format: iv:tag:encrypted (all hex-encoded, colon-separated)
 */
export function decrypt(encryptedStr: string, passphrase: string): string {
  const parts = encryptedStr.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  const [ivHex, tagHex, encrypted] = parts;
  const key = deriveKey(passphrase);
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Encrypt Git credentials for storage
 */
export function encryptGitCredentials(
  credentials: { type: string; token?: string; sshKey?: string; passphrase?: string },
  encryptionKey: string
): string {
  return encrypt(JSON.stringify(credentials), encryptionKey);
}

/**
 * Decrypt Git credentials from storage
 */
export function decryptGitCredentials(
  encryptedRef: string,
  encryptionKey: string
): { type: string; token?: string; sshKey?: string; passphrase?: string } {
  const json = decrypt(encryptedRef, encryptionKey);
  return JSON.parse(json);
}
