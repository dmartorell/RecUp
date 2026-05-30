import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { config } from '../config/env.js';

const PREFIX = 'enc:v1:';
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

let cachedKey = null;
function getKey() {
  if (cachedKey) return cachedKey;
  cachedKey = createHash('sha256').update(config.cryptoSecret, 'utf8').digest();
  return cachedKey;
}

export function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export function encrypt(plaintext) {
  if (plaintext == null || plaintext === '') return plaintext;
  if (isEncrypted(plaintext)) return plaintext;
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, ct, tag]).toString('base64');
}

export function decrypt(value) {
  if (value == null || value === '') return value;
  if (!isEncrypted(value)) return value;
  const buf = Buffer.from(value.slice(PREFIX.length), 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const ct = buf.subarray(IV_LEN, buf.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

export function hint(value) {
  if (!value) return '';
  const tail = value.slice(-4);
  return `••••${tail}`;
}
