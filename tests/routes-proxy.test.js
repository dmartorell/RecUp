import { describe, test, expect, beforeAll, afterAll, mock } from 'bun:test';
import { seedTestUser, cleanDb } from './setup.js';

let app, server, baseUrl, authToken, userId;
const originalFetch = global.fetch;

async function setUserSettings(settings) {
  const { default: db } = await import('../server/db.js');
  await db.execute({
    sql: `UPDATE users SET anthropic_api_key = ?, clickup_api_key = ?, clickup_list_id = ? WHERE id = ?`,
    args: [
      settings.anthropic_api_key ?? null,
      settings.clickup_api_key ?? null,
      settings.clickup_list_id ?? null,
      userId,
    ],
  });
}

beforeAll(async () => {
  const mod = await import('../server/app.js');
  app = mod.app;
  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;
  await cleanDb();
  const user = await seedTestUser('Proxy User', 'proxy@example.com', 'password123');
  authToken = user.token;
  userId = user.id;
});

afterAll(async () => {
  global.fetch = originalFetch;
  await cleanDb();
  server?.close();
});

const authHeader = () => ({ 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' });

describe('POST /api/summarize', () => {
  test('sin auth -> 401', async () => {
    const res = await fetch(`${baseUrl}/api/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: 'test' }),
    });
    expect(res.status).toBe(401);
  });

  test('sin transcript -> 400 TRANSCRIPT_REQUIRED', async () => {
    const res = await fetch(`${baseUrl}/api/summarize`, {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('TRANSCRIPT_REQUIRED');
  });

  test('sin anthropic_api_key -> 400 SETTINGS_NOT_CONFIGURED', async () => {
    await setUserSettings({ anthropic_api_key: null });
    const res = await fetch(`${baseUrl}/api/summarize`, {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({ transcript: 'test transcript' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('SETTINGS_NOT_CONFIGURED');
  });

  test('con mock fetch OK -> 200 + parsed JSON', async () => {
    await setUserSettings({ anthropic_api_key: 'test-api-key' });

    const mockResponse = {
      is_bug: true,
      title: 'Bug en login',
      transcript: 'El boton no responde',
      bullets: ['Paso 1: Abrir app', 'Paso 2: Click login'],
    };

    global.fetch = mock(async (url, opts) => {
      if (typeof url === 'string' && url.includes('anthropic')) {
        return new Response(JSON.stringify({
          content: [{ text: JSON.stringify(mockResponse) }],
        }), { status: 200 });
      }
      return originalFetch(url, opts);
    });

    const res = await originalFetch(`${baseUrl}/api/summarize`, {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({ transcript: 'El boton de login no responde' }),
    });

    global.fetch = originalFetch;
    await setUserSettings({ anthropic_api_key: null });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.is_bug).toBe(true);
    expect(body.title).toBe('Bug en login');
    expect(Array.isArray(body.bullets)).toBe(true);
  });

  test('con mock fetch error -> 401 + CLAUDE_API_ERROR', async () => {
    await setUserSettings({ anthropic_api_key: 'test-api-key' });

    global.fetch = mock(async (url, opts) => {
      if (typeof url === 'string' && url.includes('anthropic')) {
        return new Response('Unauthorized', { status: 401 });
      }
      return originalFetch(url, opts);
    });

    const res = await originalFetch(`${baseUrl}/api/summarize`, {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({ transcript: 'test' }),
    });

    global.fetch = originalFetch;
    await setUserSettings({ anthropic_api_key: null });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('CLAUDE_API_ERROR');
  });
});

describe('POST /api/ticket', () => {
  test('sin auth -> 401', async () => {
    const res = await fetch(`${baseUrl}/api/ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test' }),
    });
    expect(res.status).toBe(401);
  });

  test('sin name -> 400 NAME_REQUIRED', async () => {
    const res = await fetch(`${baseUrl}/api/ticket`, {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({ markdown_description: 'desc' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('NAME_REQUIRED');
  });

  test('sin settings de clickup -> 400 SETTINGS_NOT_CONFIGURED', async () => {
    await setUserSettings({ clickup_api_key: null, clickup_list_id: null });
    const res = await fetch(`${baseUrl}/api/ticket`, {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({ name: 'Test ticket' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('SETTINGS_NOT_CONFIGURED');
  });

  test('con mock fetch OK -> 200 + {id, url}', async () => {
    await setUserSettings({ clickup_api_key: 'test-clickup-key', clickup_list_id: 'test-list-id' });

    const { ClickUpService } = await import('../server/services/ClickUpService.js');
    const originalResolve = ClickUpService.resolveEmailToUserId.bind(ClickUpService);
    ClickUpService.resolveEmailToUserId = mock(async () => 123);

    global.fetch = mock(async (url, opts) => {
      if (typeof url === 'string' && url.includes('clickup')) {
        return new Response(JSON.stringify({ id: 'task-abc', url: 'https://app.clickup.com/t/task-abc' }), { status: 200 });
      }
      return originalFetch(url, opts);
    });

    const res = await originalFetch(`${baseUrl}/api/ticket`, {
      method: 'POST',
      headers: authHeader(),
      body: JSON.stringify({ name: 'Test Bug', reporterEmail: 'reporter@example.com' }),
    });

    global.fetch = originalFetch;
    ClickUpService.resolveEmailToUserId = originalResolve;
    await setUserSettings({ clickup_api_key: null, clickup_list_id: null });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(body.url).toBeTruthy();
  });
});

describe('POST /api/attachment', () => {
  test('sin auth -> 401', async () => {
    const res = await fetch(`${baseUrl}/api/attachment`, {
      method: 'POST',
    });
    expect(res.status).toBe(401);
  });

  test('sin taskId -> 400 TASK_ID_REQUIRED', async () => {
    const formData = new FormData();
    formData.append('attachment', new Blob(['test content'], { type: 'text/plain' }), 'test.txt');

    const res = await fetch(`${baseUrl}/api/attachment`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: formData,
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('TASK_ID_REQUIRED');
  });

  test('sin files -> 400 FILE_REQUIRED', async () => {
    const formData = new FormData();
    formData.append('taskId', 'some-task-id');

    const res = await fetch(`${baseUrl}/api/attachment`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: formData,
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('FILE_REQUIRED');
  });
});
