import { Router } from 'express';
import db, { logDbError } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/api/incidents', (req, res) => {
  const limit = Math.max(1, parseInt(req.query.limit) || 20);
  const offset = Math.max(0, parseInt(req.query.offset) || 0);

  try {
    const incidents = db.prepare(
      `SELECT * FROM incidents WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(req.user.id, limit, offset);

    const total = db.prepare(
      'SELECT COUNT(*) as count FROM incidents WHERE user_id = ?'
    ).get(req.user.id).count;

    const parsed = incidents.map(incident => ({
      ...incident,
      bullets: incident.bullets ? JSON.parse(incident.bullets) : [],
    }));

    return res.json({ success: true, data: { incidents: parsed, total } });
  } catch (err) {
    logDbError(err, 'GET /api/incidents');
    return res.status(500).json({ success: false, error: 'INTERNAL_ERROR' });
  }
});

router.post('/api/incidents', (req, res) => {
  const {
    transcript, title, bullets, status, source_type,
    duration_ms, clickup_task_id, clickup_task_url,
  } = req.body || {};

  if (!transcript || !transcript.trim()) {
    return res.status(400).json({ success: false, error: 'TRANSCRIPT_REQUIRED' });
  }

  try {
    const bulletsJson = Array.isArray(bullets) ? JSON.stringify(bullets) : (bullets || null);
    const result = db.prepare(
      `INSERT INTO incidents (user_id, transcript, title, bullets, status, source_type, duration_ms, clickup_task_id, clickup_task_url)
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

    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(result.lastInsertRowid);
    incident.bullets = incident.bullets ? JSON.parse(incident.bullets) : [];

    return res.status(201).json({ success: true, data: { incident } });
  } catch (err) {
    logDbError(err, 'POST /api/incidents');
    return res.status(500).json({ success: false, error: 'INTERNAL_ERROR' });
  }
});

router.patch('/api/incidents/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });

  try {
    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id);
    if (!incident) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    if (incident.user_id !== req.user.id) return res.status(403).json({ success: false, error: 'UNAUTHORIZED' });

    const allowed = ['clickup_task_id', 'clickup_task_url', 'status', 'title', 'bullets', 'transcript'];
    const fields = Object.keys(req.body || {}).filter(k => allowed.includes(k));
    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'NO_VALID_FIELDS' });
    }

    const values = fields.map(k => {
      if (k === 'bullets') return Array.isArray(req.body[k]) ? JSON.stringify(req.body[k]) : req.body[k];
      return req.body[k];
    });

    db.prepare(
      `UPDATE incidents SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE id = ?`
    ).run(...values, id);

    const updated = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id);
    updated.bullets = updated.bullets ? JSON.parse(updated.bullets) : [];

    return res.json({ success: true, data: { incident: updated } });
  } catch (err) {
    logDbError(err, 'PATCH /api/incidents/:id');
    return res.status(500).json({ success: false, error: 'INTERNAL_ERROR' });
  }
});

router.delete('/api/incidents/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });

  try {
    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id);
    if (!incident) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    if (incident.user_id !== req.user.id) return res.status(403).json({ success: false, error: 'UNAUTHORIZED' });

    db.prepare('DELETE FROM incidents WHERE id = ?').run(id);
    return res.json({ success: true });
  } catch (err) {
    logDbError(err, 'DELETE /api/incidents/:id');
    return res.status(500).json({ success: false, error: 'INTERNAL_ERROR' });
  }
});

export default router;
