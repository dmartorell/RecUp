import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import db from '../db.js';

const router = Router();

router.get('/api/settings', authMiddleware, async (req, res, next) => {
  try {
    const result = await db.execute({
      sql: 'SELECT clickup_api_key, clickup_list_id, anthropic_api_key FROM users WHERE id = ?',
      args: [req.user.id],
    });
    const row = result.rows[0] || {};
    return res.json({
      clickup_api_key: row.clickup_api_key || '',
      clickup_list_id: row.clickup_list_id || '',
      anthropic_api_key: row.anthropic_api_key || '',
    });
  } catch (err) {
    next(err);
  }
});

router.put('/api/settings', authMiddleware, async (req, res, next) => {
  const { clickup_api_key, clickup_list_id, anthropic_api_key } = req.body;
  try {
    await db.execute({
      sql: `UPDATE users SET
        clickup_api_key = ?,
        clickup_list_id = ?,
        anthropic_api_key = ?
        WHERE id = ?`,
      args: [
        clickup_api_key?.trim() || null,
        clickup_list_id?.trim() || null,
        anthropic_api_key?.trim() || null,
        req.user.id,
      ],
    });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
