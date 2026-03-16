import db from '../db.js';

function parseBullets(incident) {
  return { ...incident, bullets: incident.bullets ? JSON.parse(incident.bullets) : [] };
}

function serializeBullets(bullets) {
  return Array.isArray(bullets) ? JSON.stringify(bullets) : (bullets || null);
}

export const IncidentService = {
  async list(userId, { limit = 20, offset = 0 } = {}) {
    const result = await db.execute({
      sql: 'SELECT * FROM incidents WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      args: [userId, limit, offset],
    });
    const countResult = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM incidents WHERE user_id = ?',
      args: [userId],
    });
    return { incidents: result.rows.map(parseBullets), total: countResult.rows[0].count };
  },

  async create(userId, data) {
    const result = await db.execute({
      sql: `INSERT INTO incidents (user_id, transcript, title, bullets, status, source_type, duration_ms, clickup_task_id, clickup_task_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [userId, data.transcript.trim(), data.title || null, serializeBullets(data.bullets),
        data.status || 'procesando', data.source_type || null, data.duration_ms || 0,
        data.clickup_task_id || null, data.clickup_task_url || null],
    });
    const row = await db.execute({
      sql: 'SELECT * FROM incidents WHERE id = ?',
      args: [Number(result.lastInsertRowid)],
    });
    return parseBullets(row.rows[0]);
  },

  async getById(id) {
    const result = await db.execute({
      sql: 'SELECT * FROM incidents WHERE id = ?',
      args: [id],
    });
    return result.rows[0] ? parseBullets(result.rows[0]) : null;
  },

  async update(id, fields) {
    const allowed = ['clickup_task_id', 'clickup_task_url', 'status', 'title', 'bullets', 'transcript'];
    const valid = Object.keys(fields).filter(k => allowed.includes(k));
    if (valid.length === 0) return null;
    const values = valid.map(k => k === 'bullets' ? serializeBullets(fields[k]) : fields[k]);
    await db.execute({
      sql: `UPDATE incidents SET ${valid.map(f => `${f} = ?`).join(', ')} WHERE id = ?`,
      args: [...values, id],
    });
    const result = await db.execute({
      sql: 'SELECT * FROM incidents WHERE id = ?',
      args: [id],
    });
    return parseBullets(result.rows[0]);
  },

  async delete(id) {
    await db.execute({
      sql: 'DELETE FROM incidents WHERE id = ?',
      args: [id],
    });
  },

  assertOwnership(incident, userId) {
    if (Number(incident.user_id) !== Number(userId)) {
      const err = new Error('UNAUTHORIZED');
      err.status = 403;
      err.code = 'UNAUTHORIZED';
      throw err;
    }
  },
};
