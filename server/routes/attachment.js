import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

router.post('/api/attachment', authMiddleware, upload.array('attachment', 5), async (req, res) => {
  const { taskId } = req.body;

  if (!taskId) {
    return res.status(400).json({ error: 'TASK_ID_REQUIRED' });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'FILE_REQUIRED' });
  }

  const apiKey = process.env.CLICKUP_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API_KEY_MISSING' });
  }

  const results = [];

  for (const file of req.files) {
    const formData = new FormData();
    formData.append(
      'attachment',
      new Blob([file.buffer], { type: file.mimetype }),
      file.originalname
    );

    try {
      const capturaFieldId = '567894b1-a0bf-4ae5-926d-5e0a4d55a982';
      const response = await fetch(
        `https://api.clickup.com/api/v2/task/${taskId}/attachment?custom_field_id=${capturaFieldId}`,
        {
          method: 'POST',
          headers: { 'Authorization': apiKey },
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          error: data,
          file: file.originalname,
          uploaded: results,
        });
      }

      results.push(data);
    } catch (err) {
      return res.status(500).json({
        error: 'UPLOAD_ERROR',
        file: file.originalname,
        uploaded: results,
      });
    }
  }

  return res.json({ attachments: results });
});

export default router;
