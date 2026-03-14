import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

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

import db from '../server/db.js';

let insertados = 0;
let yaExistian = 0;

for (const user of users) {
  const { name, email, password, clickup_user_id } = user;

  if (!name || !email || !password) {
    console.warn(`Saltando usuario invalido: ${JSON.stringify(user)}`);
    continue;
  }

  const hashed = await Bun.password.hash(password);

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    yaExistian++;
    continue;
  }

  const result = db.prepare(
    'INSERT INTO users (name, email, password) VALUES (?, ?, ?)'
  ).run(name.trim(), email.toLowerCase(), hashed);

  if (clickup_user_id) {
    db.prepare('UPDATE users SET clickup_user_id = ? WHERE id = ?')
      .run(String(clickup_user_id), result.lastInsertRowid);
  }

  insertados++;
}

console.log(`Seed completado: ${insertados} insertados, ${yaExistian} ya existian`);
