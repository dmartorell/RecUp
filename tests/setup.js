import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret-for-testing';

export async function createTestApp() {
  const mod = await import('../server/app.js');
  return mod.app;
}

export function getAuthToken(userId, name, email) {
  return jwt.sign(
    { sub: userId, name, email },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

export async function seedTestUser(name, email, password) {
  const { default: db } = await import('../server/db.js');
  const hashed = await Bun.password.hash(password);
  const result = db.prepare(
    'INSERT INTO users (name, email, password) VALUES (?, ?, ?)'
  ).run(name, email.toLowerCase(), hashed);
  const id = result.lastInsertRowid;
  const token = getAuthToken(id, name, email.toLowerCase());
  return { id, token };
}

export async function cleanDb() {
  const { default: db } = await import('../server/db.js');
  db.exec('DELETE FROM incidents; DELETE FROM users;');
}
