import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import jwt from 'jsonwebtoken';
import { cleanDb, seedTestUser } from './setup.js';

const JWT_SECRET = 'test-secret-for-testing';

let app, server, baseUrl, userId, userEmail;

beforeAll(async () => {
  const mod = await import('../server/app.js');
  app = mod.app;
  server = app.listen(0);
  baseUrl = `http://localhost:${server.address().port}`;
  await cleanDb();
  userEmail = 'renew@example.com';
  const user = await seedTestUser('Renew User', userEmail, 'password123');
  userId = user.id;
});

afterAll(async () => {
  await cleanDb();
  server?.close();
});

function tokenWithExpiry(expiresIn) {
  return jwt.sign({ sub: userId, name: 'Renew User', email: userEmail }, JWT_SECRET, {
    expiresIn,
  });
}

describe('JWT renovación silenciosa', () => {
  test('token fresco (>3d restantes) NO devuelve X-New-Token', async () => {
    const token = tokenWithExpiry('7d');
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('X-New-Token')).toBeNull();
  });

  test('token con poca vida (<3d) devuelve X-New-Token con un JWT renovado', async () => {
    const token = tokenWithExpiry('1d');
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const fresh = res.headers.get('X-New-Token');
    expect(fresh).toBeTruthy();
    const decoded = jwt.verify(fresh, JWT_SECRET);
    expect(decoded.sub).toBe(userId);
    expect(decoded.email).toBe(userEmail);
    // El nuevo token caduca más tarde que el viejo
    const oldExp = jwt.verify(token, JWT_SECRET).exp;
    expect(decoded.exp).toBeGreaterThan(oldExp);
  });

  test('token expirado -> 401, sin X-New-Token', async () => {
    const token = jwt.sign({ sub: userId, name: 'Renew User', email: userEmail }, JWT_SECRET, {
      expiresIn: '-1s',
    });
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
    expect(res.headers.get('X-New-Token')).toBeNull();
  });
});
