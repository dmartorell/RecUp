import { beforeAll, describe, expect, test } from 'bun:test';

let app;

beforeAll(async () => {
  const mod = await import('../server/app.js');
  app = mod.app;
});

describe('trust proxy', () => {
  test('app trusts the first hop so req.ip resolves from X-Forwarded-For', () => {
    expect(app.get('trust proxy')).toBe(1);
  });
});
