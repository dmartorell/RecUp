import { Database } from 'bun:sqlite';
import { mkdirSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

mkdirSync(join(PROJECT_ROOT, 'data'), { recursive: true });
mkdirSync(join(PROJECT_ROOT, 'dbLogs'), { recursive: true });

const DB_PATH = process.env.DB_PATH || join(PROJECT_ROOT, 'data', 'recup.db');
const LOG_PATH = join(PROJECT_ROOT, 'dbLogs', 'errors.log');

export function logDbError(error, context = '') {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${context}: ${error?.message || error}\n`;
  appendFileSync(LOG_PATH, line);
}

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    clickup_user_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    transcript TEXT,
    title TEXT,
    bullets TEXT,
    status TEXT DEFAULT 'procesando' CHECK(status IN ('procesando','completado','error')),
    source_type TEXT CHECK(source_type IN ('audio','text','extension')),
    duration_ms INTEGER DEFAULT 0,
    clickup_task_id TEXT,
    clickup_task_url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_incidents_user_id ON incidents(user_id);
`);

process.on('SIGINT', () => { db.close(); process.exit(0); });
process.on('SIGTERM', () => { db.close(); process.exit(0); });

export default db;
