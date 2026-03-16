import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { seedTestUser, cleanDb } from './setup.js';

let app, server, baseUrl, userToken, user2Token, incidentId;

beforeAll(async () => {
  const mod = await import('../server/app.js');
  app = mod.app;
  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;
  await cleanDb();
  const user1 = await seedTestUser('Owner User', 'owner@example.com', 'password123');
  const user2 = await seedTestUser('Other User', 'other@example.com', 'password123');
  userToken = user1.token;
  user2Token = user2.token;
});

afterAll(async () => {
  await cleanDb();
  server?.close();
});

describe('GET /api/incidents sin auth', () => {
  test('sin authorization -> 401', async () => {
    const res = await fetch(`${baseUrl}/api/incidents`);
    expect(res.status).toBe(401);
  });
});

describe('Incidents CRUD', () => {
  test('POST /api/incidents con transcript -> 201 + incident', async () => {
    const res = await fetch(`${baseUrl}/api/incidents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify({ transcript: 'El boton de login no responde al hacer click' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.incident).toBeTruthy();
    incidentId = body.data.incident.id;
  });

  test('POST /api/incidents sin transcript -> 400 TRANSCRIPT_REQUIRED', async () => {
    const res = await fetch(`${baseUrl}/api/incidents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('TRANSCRIPT_REQUIRED');
  });

  test('GET /api/incidents -> 200 + lista con incident creado', async () => {
    const res = await fetch(`${baseUrl}/api/incidents`, {
      headers: { 'Authorization': `Bearer ${userToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.incidents)).toBe(true);
    expect(body.data.incidents.length).toBeGreaterThan(0);
  });

  test('PATCH /api/incidents/:id actualiza campos -> 200', async () => {
    const res = await fetch(`${baseUrl}/api/incidents/${incidentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify({ title: 'Titulo actualizado' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.incident.title).toBe('Titulo actualizado');
  });

  test('PATCH /api/incidents/:id de otro user -> 403', async () => {
    const res = await fetch(`${baseUrl}/api/incidents/${incidentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user2Token}`,
      },
      body: JSON.stringify({ title: 'Intento de hijack' }),
    });
    expect(res.status).toBe(403);
  });

  test('DELETE /api/incidents/:id -> 200', async () => {
    const res = await fetch(`${baseUrl}/api/incidents/${incidentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${userToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('DELETE /api/incidents/:id inexistente -> 404', async () => {
    const res = await fetch(`${baseUrl}/api/incidents/999999`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${userToken}` },
    });
    expect(res.status).toBe(404);
  });
});
