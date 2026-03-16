import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = 'test-secret-for-testing';

export async function createTestApp() {
  const { initDb } = await import('../server/db.js');
  await initDb();
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
  const hashed = await bcrypt.hash(password, 10);
  const result = await db.execute({
    sql: 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
    args: [name, email.toLowerCase(), hashed],
  });
  const id = Number(result.lastInsertRowid);
  const token = getAuthToken(id, name, email.toLowerCase());
  return { id, token };
}

export async function cleanDb() {
  const { default: db, initDb } = await import('../server/db.js');
  await initDb();
  await db.executeMultiple('DELETE FROM incidents; DELETE FROM users;');
}
