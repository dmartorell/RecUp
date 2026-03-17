import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { signToken, authMiddleware } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import { config } from '../config/env.js';
import { ClickUpService } from '../services/ClickUpService.js';

const router = Router();
const rateLimit = createRateLimiter();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/api/auth/register', rateLimit, async (req, res, next) => {
  const { name, email, password } = req.body || {};

  if (!name || typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 100) {
    return res.status(400).json({ success: false, error: 'INVALID_NAME' });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ success: false, error: 'INVALID_EMAIL' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ success: false, error: 'WEAK_PASSWORD' });
  }

  if (config.allowedEmailDomain) {
    const domain = `@${config.allowedEmailDomain.replace(/^@/, '')}`;
    if (!email.toLowerCase().endsWith(domain.toLowerCase())) {
      return res.status(400).json({ success: false, error: 'EMAIL_DOMAIN' });
    }
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await db.execute({
      sql: 'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      args: [name.trim(), email.toLowerCase(), hashed],
    });

    const token = signToken(Number(result.lastInsertRowid), name.trim(), email.toLowerCase());
    return res.status(201).json({
      success: true,
      data: {
        token,
        user: { name: name.trim(), email: email.toLowerCase() },
      },
    });
  } catch (err) {
    if (err?.message?.includes('UNIQUE')) {
      return res.status(409).json({ success: false, error: 'EMAIL_TAKEN' });
    }
    next(err);
  }
});

router.post('/api/auth/login', rateLimit, async (req, res, next) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'REQUIRED_FIELDS' });
  }

  try {
    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [email.toLowerCase()],
    });
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ success: false, error: 'INVALID_CREDENTIALS' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'INVALID_CREDENTIALS' });
    }

    const token = signToken(Number(user.id), user.name, user.email);
    let avatar = user.avatar_url || null;
    if (user.clickup_api_key) {
      try {
        const clickupAvatar = await ClickUpService.resolveAvatarByEmail(user.email, user.clickup_api_key);
        if (clickupAvatar) {
          avatar = clickupAvatar;
          db.execute({ sql: 'UPDATE users SET avatar_url = ? WHERE id = ?', args: [avatar, user.id] });
        }
      } catch {}
    }
    return res.json({
      success: true,
      data: {
        token,
        user: { name: user.name, email: user.email, avatar },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/api/auth/me', authMiddleware, async (req, res, next) => {
  try {
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [req.user.id] });
    const user = result.rows[0];
    if (!user) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    return res.json({ success: true, data: { user: { name: user.name, email: user.email, avatar: user.avatar_url || null } } });
  } catch (err) { next(err); }
});

export default router;
