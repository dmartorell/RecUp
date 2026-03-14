import { randomUUID } from 'crypto';
import db, { logDbError } from '../db.js';

const SESSION_TTL_DAYS = 7;

export function createSession(userId) {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);

  try {
    db.prepare(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).run(userId, token, expiresAt);
  } catch (err) {
    logDbError(err, 'createSession');
    throw err;
  }

  return token;
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No autorizado' });
  }

  const token = authHeader.slice(7);

  try {
    const session = db.prepare(
      `SELECT s.user_id, u.name, u.email
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > datetime('now')`
    ).get(token);

    if (!session) {
      return res.status(401).json({ success: false, error: 'No autorizado' });
    }

    req.user = { id: session.user_id, name: session.name, email: session.email };
    next();
  } catch (err) {
    logDbError(err, 'authMiddleware');
    return res.status(500).json({ success: false, error: 'Error interno' });
  }
}
