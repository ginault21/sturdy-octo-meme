import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
// Algorithm constants for documentation (used implicitly by crypto module)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _AUTH_TAG_LENGTH = 16;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _KEY_LENGTH = 32;

export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoError';
  }
}

function getKey(): Buffer {
  if (!ENCRYPTION_KEY) {
    throw new CryptoError('ENCRYPTION_KEY environment variable is required');
  }
  if (ENCRYPTION_KEY.length !== 64) {
    throw new CryptoError('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  return Buffer.from(ENCRYPTION_KEY, 'hex');
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  const authTag = cipher.getAuthTag();

  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(
    ':'
  );
}

export function decrypt(ciphertext: string): string {
  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new CryptoError('Invalid ciphertext format');
    }

    const [ivBase64, authTagBase64, encryptedBase64] = parts;
    const key = getKey();
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const encrypted = Buffer.from(encryptedBase64, 'base64');

    if (iv.length !== IV_LENGTH) {
      throw new CryptoError('Invalid IV length');
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    if (error instanceof CryptoError) {
      throw error;
    }
    throw new CryptoError('Decryption failed');
  }
}
