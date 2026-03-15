import { Router } from 'express';
import db, { logDbError } from '../db.js';
import { signToken } from '../middleware/auth.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const loginAttempts = new Map();

function rateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || [];
  const recent = attempts.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    return res.status(429).json({ success: false, error: 'Demasiados intentos. Espera un minuto.' });
  }
  recent.push(now);
  loginAttempts.set(ip, recent);
  next();
}

router.post('/api/auth/register', rateLimit, async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 100) {
    return res.status(400).json({ success: false, error: 'Nombre invalido (1-100 caracteres)' });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ success: false, error: 'Email inválido' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ success: false, error: 'Contraseña: mínimo 6 caracteres' });
  }

  const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN;
  if (allowedDomain) {
    const domain = `@${allowedDomain.replace(/^@/, '')}`;
    if (!email.toLowerCase().endsWith(domain.toLowerCase())) {
      return res.status(400).json({ success: false, error: `Email debe ser del dominio ${domain}` });
    }
  }

  try {
    const hashed = await Bun.password.hash(password);
    const result = db.prepare(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)'
    ).run(name.trim(), email.toLowerCase(), hashed);

    const token = signToken(result.lastInsertRowid, name.trim(), email.toLowerCase());
    return res.status(201).json({
      success: true,
      data: {
        token,
        user: { id: result.lastInsertRowid, name: name.trim(), email: email.toLowerCase() },
      },
    });
  } catch (err) {
    if (err?.message?.includes('UNIQUE')) {
      return res.status(409).json({ success: false, error: 'Email ya registrado' });
    }
    logDbError(err, 'POST /api/auth/register');
    return res.status(500).json({ success: false, error: 'Error interno' });
  }
});

router.post('/api/auth/login', rateLimit, async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email y password son obligatorios' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());

    if (!user) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    const valid = await Bun.password.verify(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    const token = signToken(user.id, user.name, user.email);
    return res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, name: user.name, email: user.email },
      },
    });
  } catch (err) {
    logDbError(err, 'POST /api/auth/login');
    return res.status(500).json({ success: false, error: 'Error interno' });
  }
});

export default router;
