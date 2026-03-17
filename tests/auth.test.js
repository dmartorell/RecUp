import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { seedTestUser, cleanDb } from './setup.js';

let app, server, baseUrl, meToken;

beforeAll(async () => {
  const mod = await import('../server/app.js');
  app = mod.app;
  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;
  await cleanDb();
});

afterAll(async () => {
  await cleanDb();
  server?.close();
});

describe('POST /api/auth/register', () => {
  test('datos validos -> 201 + token + user', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test User', email: 'test@example.com', password: 'password123' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.token).toBeTruthy();
    expect(body.data.user.email).toBe('test@example.com');
  });

  test('sin name -> 400 INVALID_NAME', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@example.com', password: 'password123' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('INVALID_NAME');
  });

  test('email invalido -> 400 INVALID_EMAIL', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'User', email: 'not-an-email', password: 'password123' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('INVALID_EMAIL');
  });

  test('password < 6 chars -> 400 WEAK_PASSWORD', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'User', email: 'b@example.com', password: '123' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('WEAK_PASSWORD');
  });

  test('email duplicado -> 409 EMAIL_TAKEN', async () => {
    await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'User A', email: 'dup@example.com', password: 'password123' }),
    });
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'User B', email: 'dup@example.com', password: 'password123' }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('EMAIL_TAKEN');
  });
});

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    await seedTestUser('Login User', 'login@example.com', 'password123');
  });

  test('credenciales validas -> 200 + token', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'login@example.com', password: 'password123' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.token).toBeTruthy();
  });

  test('sin email/password -> 400 REQUIRED_FIELDS', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('REQUIRED_FIELDS');
  });

  test('password incorrecto -> 401 INVALID_CREDENTIALS', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'login@example.com', password: 'wrongpassword' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('INVALID_CREDENTIALS');
  });

  test('email inexistente -> 401 INVALID_CREDENTIALS', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'password123' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('INVALID_CREDENTIALS');
  });
});

describe('GET /api/auth/me', () => {
  beforeAll(async () => {
    const user = await seedTestUser('Me User', 'me@example.com', 'password123');
    meToken = user.token;
  });

  test('con token valido -> 200 + user', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${meToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe('me@example.com');
  });

  test('sin token -> 401', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    expect(res.status).toBe(401);
  });
});
