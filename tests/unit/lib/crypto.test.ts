import { describe, it, expect } from 'vitest';

import { encrypt, decrypt, CryptoError } from '../../../app/lib/crypto.server.js';

describe('crypto', () => {
  it('should encrypt and decrypt round-trip', () => {
    const plaintext = 'sensitive-data-123';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertext for same plaintext', () => {
    const plaintext = 'test';
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should throw CryptoError for invalid ciphertext format', () => {
    expect(() => decrypt('invalid')).toThrow(CryptoError);
    expect(() => decrypt('a:b')).toThrow(CryptoError);
  });

  it('should throw CryptoError for tampered ciphertext', () => {
    const plaintext = 'test';
    const encrypted = encrypt(plaintext);
    const tampered = encrypted.slice(0, -5) + 'XXXXX';
    expect(() => decrypt(tampered)).toThrow(CryptoError);
  });
});
