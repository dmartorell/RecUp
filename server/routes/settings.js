import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { decrypt, encrypt, hint } from '../services/crypto.js';

const DEFAULT_CLICKUP_LIST_ID = '193679011';
const ENCRYPTED_FIELDS = ['clickup_api_key', 'anthropic_api_key', 'openai_api_key'];

const router = Router();

router.get('/api/settings', authMiddleware, async (req, res, next) => {
  try {
    const result = await db.execute({
      sql: 'SELECT clickup_api_key, clickup_list_id, anthropic_api_key, openai_api_key, ai_provider FROM users WHERE id = ?',
      args: [req.user.id],
    });
    const row = result.rows[0] || {};
    const payload = {
      clickup_list_id: row.clickup_list_id || DEFAULT_CLICKUP_LIST_ID,
      ai_provider: row.ai_provider || 'anthropic',
    };
    for (const field of ENCRYPTED_FIELDS) {
      const plain = decrypt(row[field]);
      payload[field] = {
        configured: Boolean(plain),
        hint: hint(plain),
      };
    }
    return res.json(payload);
  } catch (err) {
    next(err);
  }
});

router.put('/api/settings', authMiddleware, async (req, res, next) => {
  const { clickup_api_key, clickup_list_id, anthropic_api_key, openai_api_key, ai_provider } =
    req.body || {};
  const provider = ['anthropic', 'openai'].includes(ai_provider) ? ai_provider : 'anthropic';

  const sets = ['clickup_list_id = ?', 'ai_provider = ?'];
  const args = [clickup_list_id?.trim() || null, provider];

  for (const [field, value] of [
    ['clickup_api_key', clickup_api_key],
    ['anthropic_api_key', anthropic_api_key],
    ['openai_api_key', openai_api_key],
  ]) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    sets.push(`${field} = ?`);
    args.push(trimmed ? encrypt(trimmed) : null);
  }

  args.push(req.user.id);

  try {
    await db.execute({
      sql: `UPDATE users SET ${sets.join(', ')} WHERE id = ?`,
      args,
    });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
