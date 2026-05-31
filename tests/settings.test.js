import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { decrypt, encrypt, isEncrypted } from '../server/services/crypto.js';
import { cleanDb, seedTestUser } from './setup.js';

let app, server, baseUrl, authToken, userId;

beforeAll(async () => {
  const mod = await import('../server/app.js');
  app = mod.app;
  server = app.listen(0);
  baseUrl = `http://localhost:${server.address().port}`;
  await cleanDb();
  const u = await seedTestUser('Settings User', 'settings@example.com', 'password123');
  authToken = u.token;
  userId = u.id;
});

afterAll(() => {
  server.close();
});

async function getDb() {
  const { default: db } = await import('../server/db.js');
  return db;
}

async function readRaw(field) {
  const db = await getDb();
  const r = await db.execute({ sql: `SELECT ${field} FROM users WHERE id = ?`, args: [userId] });
  return r.rows[0][field];
}

describe('GET /api/settings', () => {
  test('returns { configured, hint } for each API key, never the full value', async () => {
    const db = await getDb();
    await db.execute({
      sql: 'UPDATE users SET clickup_api_key = ?, anthropic_api_key = ?, openai_api_key = ? WHERE id = ?',
      args: [encrypt('pk_long_secret_AAAA'), encrypt('sk-ant-key-BBBB'), null, userId],
    });

    const res = await fetch(`${baseUrl}/api/settings`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();

    expect(data.clickup_api_key).toEqual({
      configured: true,
      hint: '••••••••••••••••••••••••AAAA',
    });
    expect(data.anthropic_api_key).toEqual({
      configured: true,
      hint: '••••••••••••••••••••••••BBBB',
    });
    expect(data.openai_api_key).toEqual({ configured: false, hint: '' });

    const blob = JSON.stringify(data);
    expect(blob).not.toContain('pk_long_secret_AAAA');
    expect(blob).not.toContain('sk-ant-key-BBBB');
  });
});

describe('PUT /api/settings', () => {
  test('encrypts API keys at rest', async () => {
    const res = await fetch(`${baseUrl}/api/settings`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ anthropic_api_key: 'sk-fresh-value', ai_provider: 'anthropic' }),
    });
    expect(res.status).toBe(200);

    const raw = await readRaw('anthropic_api_key');
    expect(isEncrypted(raw)).toBe(true);
    expect(raw).not.toContain('sk-fresh-value');
    expect(decrypt(raw)).toBe('sk-fresh-value');
  });

  test('omitting an API key field preserves the existing encrypted value', async () => {
    const db = await getDb();
    const original = encrypt('pk_preserve_ZZZZ');
    await db.execute({
      sql: 'UPDATE users SET clickup_api_key = ? WHERE id = ?',
      args: [original, userId],
    });

    const res = await fetch(`${baseUrl}/api/settings`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ai_provider: 'anthropic', clickup_list_id: '999' }),
    });
    expect(res.status).toBe(200);

    const afterRaw = await readRaw('clickup_api_key');
    expect(decrypt(afterRaw)).toBe('pk_preserve_ZZZZ');
  });

  test('empty string clears the key', async () => {
    const db = await getDb();
    await db.execute({
      sql: 'UPDATE users SET openai_api_key = ? WHERE id = ?',
      args: [encrypt('sk-to-clear'), userId],
    });

    const res = await fetch(`${baseUrl}/api/settings`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ openai_api_key: '', ai_provider: 'openai' }),
    });
    expect(res.status).toBe(200);

    const afterRaw = await readRaw('openai_api_key');
    expect(afterRaw).toBe(null);
  });
});

describe('migrateEncryptApiKeys', () => {
  test('re-encrypts plaintext legacy values on initDb', async () => {
    const db = await getDb();
    await db.execute({
      sql: 'UPDATE users SET clickup_api_key = ?, anthropic_api_key = ? WHERE id = ?',
      args: ['plain-clickup-key', 'plain-anthropic-key', userId],
    });

    const { initDb } = await import('../server/db.js');
    await initDb();

    const clickupRaw = await readRaw('clickup_api_key');
    const anthropicRaw = await readRaw('anthropic_api_key');
    expect(isEncrypted(clickupRaw)).toBe(true);
    expect(isEncrypted(anthropicRaw)).toBe(true);
    expect(decrypt(clickupRaw)).toBe('plain-clickup-key');
    expect(decrypt(anthropicRaw)).toBe('plain-anthropic-key');
  });
});
