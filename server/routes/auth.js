import { Router } from 'express';
import db, { logDbError } from '../db.js';
import { createSession } from '../middleware/auth.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 100) {
    return res.status(400).json({ success: false, error: 'Nombre invalido (1-100 caracteres)' });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ success: false, error: 'Email invalido' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password debe tener minimo 6 caracteres' });
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

    const token = createSession(result.lastInsertRowid);
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

router.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email y password son obligatorios' });
  }

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());

    if (!user) {
      return res.status(401).json({ success: false, error: 'Credenciales invalidas' });
    }

    const valid = await Bun.password.verify(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Credenciales invalidas' });
    }

    const token = createSession(user.id);
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
