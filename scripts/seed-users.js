import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = join(__filename, '..', '..');

const filePath = process.argv[2] || join(PROJECT_ROOT, 'scripts', 'users.json');

let users;
try {
  users = JSON.parse(readFileSync(filePath, 'utf8'));
} catch (err) {
  console.error(`Error leyendo fichero: ${filePath}\n${err.message}`);
  process.exit(1);
}

if (!Array.isArray(users) || users.length === 0) {
  console.error('El fichero debe contener un array de usuarios no vacio');
  process.exit(1);
}

const { default: db, initDb } = await import('../server/db.js');
await initDb();

let insertados = 0;
let yaExistian = 0;

for (const user of users) {
  const { name, email, password, clickup_user_id } = user;

  if (!name || !email || !password) {
    console.warn(`Saltando usuario invalido: ${JSON.stringify(user)}`);
    continue;
  }

  const hashed = await bcrypt.hash(password, 10);

  const existing = await db.execute({
    sql: 'SELECT id FROM users WHERE email = ?',
    args: [email.toLowerCase()],
  });
  if (existing.rows.length > 0) {
    yaExistian++;
    continue;
  }

  const result = await db.execute({
    sql: 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
    args: [name.trim(), email.toLowerCase(), hashed],
  });

  if (clickup_user_id) {
    await db.execute({
      sql: 'UPDATE users SET clickup_user_id = ? WHERE id = ?',
      args: [String(clickup_user_id), Number(result.lastInsertRowid)],
    });
  }

  insertados++;
}

console.log(`Seed completado: ${insertados} insertados, ${yaExistian} ya existian`);
