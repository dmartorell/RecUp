import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.js';
import { ClickUpService } from '../services/ClickUpService.js';
import { config } from '../config/env.js';
import { MULTER_MAX_FILE_SIZE, MULTER_MAX_FILES } from '../config/constants.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MULTER_MAX_FILE_SIZE },
});

router.post('/api/attachment', authMiddleware, upload.array('attachment', MULTER_MAX_FILES), async (req, res, next) => {
  const { taskId } = req.body;

  if (!taskId) {
    return res.status(400).json({ error: 'TASK_ID_REQUIRED' });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'FILE_REQUIRED' });
  }

  if (!config.clickupApiKey) {
    return res.status(500).json({ error: 'API_KEY_MISSING' });
  }

  const results = [];

  for (const file of req.files) {
    try {
      const data = await ClickUpService.uploadAttachment(taskId, file);
      results.push(data);
    } catch (err) {
      return res.status(err.status || 500).json({
        error: err.code || 'UPLOAD_ERROR',
        file: file.originalname,
        uploaded: results,
      });
    }
  }

  return res.json({ attachments: results });
});

export default router;
