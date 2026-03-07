import { Router } from 'express';
import multer from 'multer';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

router.post('/api/attachment', upload.array('attachment', 5), async (req, res) => {
  const { taskId } = req.body;

  if (!taskId) {
    return res.status(400).json({ error: 'taskId es obligatorio' });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'Se requiere al menos un archivo' });
  }

  const apiKey = process.env.CLICKUP_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'CLICKUP_API_KEY no esta configurada en el servidor' });
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
      const response = await fetch(
        `https://api.clickup.com/api/v2/task/${taskId}/attachment`,
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
        error: `Error subiendo ${file.originalname}: ${err.message}`,
        file: file.originalname,
        uploaded: results,
      });
    }
  }

  return res.json({ attachments: results });
});

export default router;
