import { describe, test, expect } from 'bun:test';
import { encrypt, decrypt, isEncrypted, hint } from '../server/services/crypto.js';

describe('crypto service', () => {
  test('round-trip preserves the plaintext', () => {
    const original = 'pk_48768217_F7GX90LUCQ8R8T8SNHK1WQF0HAQTBKT6';
    const encrypted = encrypt(original);
    expect(encrypted).not.toBe(original);
    expect(isEncrypted(encrypted)).toBe(true);
    expect(decrypt(encrypted)).toBe(original);
  });

  test('encrypt produces a different ciphertext for the same plaintext (random IV)', () => {
    const a = encrypt('same-value');
    const b = encrypt('same-value');
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe('same-value');
    expect(decrypt(b)).toBe('same-value');
  });

  test('encrypt is idempotent on already-encrypted values', () => {
    const once = encrypt('foo');
    const twice = encrypt(once);
    expect(twice).toBe(once);
  });

  test('decrypt returns plaintext unchanged when not prefixed (legacy migration safety)', () => {
    expect(decrypt('plain-legacy-value')).toBe('plain-legacy-value');
  });

  test('decrypt throws on tampered ciphertext (auth tag verification)', () => {
    const enc = encrypt('secret-payload');
    const tampered = enc.slice(0, -4) + 'AAAA';
    expect(() => decrypt(tampered)).toThrow();
  });

  test('encrypt passes through null and empty string', () => {
    expect(encrypt(null)).toBe(null);
    expect(encrypt('')).toBe('');
    expect(decrypt(null)).toBe(null);
    expect(decrypt('')).toBe('');
  });

  test('hint masks all but the last 4 characters', () => {
    expect(hint('pk_long_secret_key_ABCD')).toBe('••••ABCD');
    expect(hint('')).toBe('');
    expect(hint(null)).toBe('');
  });
});
