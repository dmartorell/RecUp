import db from '../db.js';

function parseBullets(incident) {
  return { ...incident, bullets: incident.bullets ? JSON.parse(incident.bullets) : [] };
}

function serializeBullets(bullets) {
  return Array.isArray(bullets) ? JSON.stringify(bullets) : (bullets || null);
}

export const IncidentService = {
  list(userId, { limit = 20, offset = 0 } = {}) {
    const incidents = db.prepare(
      'SELECT * FROM incidents WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(userId, limit, offset);
    const total = db.prepare('SELECT COUNT(*) as count FROM incidents WHERE user_id = ?').get(userId).count;
    return { incidents: incidents.map(parseBullets), total };
  },

  create(userId, data) {
    const result = db.prepare(
      `INSERT INTO incidents (user_id, transcript, title, bullets, status, source_type, duration_ms, clickup_task_id, clickup_task_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(userId, data.transcript.trim(), data.title || null, serializeBullets(data.bullets),
      data.status || 'procesando', data.source_type || null, data.duration_ms || 0,
      data.clickup_task_id || null, data.clickup_task_url || null);
    return parseBullets(db.prepare('SELECT * FROM incidents WHERE id = ?').get(result.lastInsertRowid));
  },

  getById(id) {
    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id);
    return incident ? parseBullets(incident) : null;
  },

  update(id, fields) {
    const allowed = ['clickup_task_id', 'clickup_task_url', 'status', 'title', 'bullets', 'transcript'];
    const valid = Object.keys(fields).filter(k => allowed.includes(k));
    if (valid.length === 0) return null;
    const values = valid.map(k => k === 'bullets' ? serializeBullets(fields[k]) : fields[k]);
    db.prepare(`UPDATE incidents SET ${valid.map(f => `${f} = ?`).join(', ')} WHERE id = ?`).run(...values, id);
    return parseBullets(db.prepare('SELECT * FROM incidents WHERE id = ?').get(id));
  },

  delete(id) {
    db.prepare('DELETE FROM incidents WHERE id = ?').run(id);
  },

  assertOwnership(incident, userId) {
    if (incident.user_id !== userId) {
      const err = new Error('UNAUTHORIZED');
      err.status = 403;
      err.code = 'UNAUTHORIZED';
      throw err;
    }
  },
};
