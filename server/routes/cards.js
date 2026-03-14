import { Router } from 'express';
import db, { logDbError } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/api/cards', (req, res) => {
  const limit = Math.max(1, parseInt(req.query.limit) || 20);
  const offset = Math.max(0, parseInt(req.query.offset) || 0);

  try {
    const cards = db.prepare(
      `SELECT * FROM cards WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(req.user.id, limit, offset);

    const total = db.prepare(
      'SELECT COUNT(*) as count FROM cards WHERE user_id = ?'
    ).get(req.user.id).count;

    const parsed = cards.map(card => ({
      ...card,
      bullets: card.bullets ? JSON.parse(card.bullets) : [],
    }));

    return res.json({ success: true, data: { cards: parsed, total } });
  } catch (err) {
    logDbError(err, 'GET /api/cards');
    return res.status(500).json({ success: false, error: 'Error interno' });
  }
});

router.post('/api/cards', (req, res) => {
  const {
    transcript, title, bullets, status, source_type,
    duration_ms, clickup_task_id, clickup_task_url,
  } = req.body || {};

  if (!transcript || !transcript.trim()) {
    return res.status(400).json({ success: false, error: 'transcript es obligatorio' });
  }

  try {
    const bulletsJson = Array.isArray(bullets) ? JSON.stringify(bullets) : (bullets || null);
    const result = db.prepare(
      `INSERT INTO cards (user_id, transcript, title, bullets, status, source_type, duration_ms, clickup_task_id, clickup_task_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      req.user.id,
      transcript.trim(),
      title || null,
      bulletsJson,
      status || 'procesando',
      source_type || null,
      duration_ms || 0,
      clickup_task_id || null,
      clickup_task_url || null,
    );

    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(result.lastInsertRowid);
    card.bullets = card.bullets ? JSON.parse(card.bullets) : [];

    return res.status(201).json({ success: true, data: { card } });
  } catch (err) {
    logDbError(err, 'POST /api/cards');
    return res.status(500).json({ success: false, error: 'Error interno' });
  }
});

router.patch('/api/cards/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'ID invalido' });

  try {
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(id);
    if (!card) return res.status(404).json({ success: false, error: 'Card no encontrada' });
    if (card.user_id !== req.user.id) return res.status(403).json({ success: false, error: 'No autorizado' });

    const allowed = ['clickup_task_id', 'clickup_task_url', 'status', 'title', 'bullets'];
    const fields = Object.keys(req.body || {}).filter(k => allowed.includes(k));
    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'No hay campos validos para actualizar' });
    }

    const values = fields.map(k => {
      if (k === 'bullets') return Array.isArray(req.body[k]) ? JSON.stringify(req.body[k]) : req.body[k];
      return req.body[k];
    });

    db.prepare(
      `UPDATE cards SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE id = ?`
    ).run(...values, id);

    const updated = db.prepare('SELECT * FROM cards WHERE id = ?').get(id);
    updated.bullets = updated.bullets ? JSON.parse(updated.bullets) : [];

    return res.json({ success: true, data: { card: updated } });
  } catch (err) {
    logDbError(err, 'PATCH /api/cards/:id');
    return res.status(500).json({ success: false, error: 'Error interno' });
  }
});

router.delete('/api/cards/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'ID invalido' });

  try {
    const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(id);
    if (!card) return res.status(404).json({ success: false, error: 'Card no encontrada' });
    if (card.user_id !== req.user.id) return res.status(403).json({ success: false, error: 'No autorizado' });

    db.prepare('DELETE FROM cards WHERE id = ?').run(id);
    return res.json({ success: true });
  } catch (err) {
    logDbError(err, 'DELETE /api/cards/:id');
    return res.status(500).json({ success: false, error: 'Error interno' });
  }
});

export default router;
