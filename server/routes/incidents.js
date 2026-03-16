import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { IncidentService } from '../services/IncidentService.js';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const limit = Math.max(1, parseInt(req.query.limit) || 20);
    const offset = Math.max(0, parseInt(req.query.offset) || 0);
    const data = await IncidentService.list(req.user.id, { limit, offset });
    return res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const { transcript } = req.body || {};
  if (!transcript || !transcript.trim()) {
    return res.status(400).json({ success: false, error: 'TRANSCRIPT_REQUIRED' });
  }
  try {
    const incident = await IncidentService.create(req.user.id, req.body);
    return res.status(201).json({ success: true, data: { incident } });
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  try {
    const incident = await IncidentService.getById(id);
    if (!incident) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    IncidentService.assertOwnership(incident, req.user.id);
    const fields = Object.keys(req.body || {});
    if (fields.length === 0) return res.status(400).json({ success: false, error: 'NO_VALID_FIELDS' });
    const updated = await IncidentService.update(id, req.body);
    if (!updated) return res.status(400).json({ success: false, error: 'NO_VALID_FIELDS' });
    return res.json({ success: true, data: { incident: updated } });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: 'INVALID_ID' });
  try {
    const incident = await IncidentService.getById(id);
    if (!incident) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    IncidentService.assertOwnership(incident, req.user.id);
    await IncidentService.delete(id);
    return res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
