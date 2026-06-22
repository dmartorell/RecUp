import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import packageJson from '../package.json' with { type: 'json' };

let server;
let baseUrl;

beforeAll(async () => {
  const mod = await import('../server/app.js');
  server = mod.app.listen(0);
  const port = server.address().port;
  baseUrl = `http://localhost:${port}`;
});

afterAll(() => {
  server?.close();
});

describe('GET /api/version', () => {
  test('returns the package version', async () => {
    const res = await fetch(`${baseUrl}/api/version`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ version: packageJson.version });
  });
});
