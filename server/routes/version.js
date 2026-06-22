import { Router } from 'express';
import packageJson from '../../package.json' with { type: 'json' };

const router = Router();
const appVersion = packageJson.version;

router.get('/api/version', (_req, res) => {
  res.json({ version: appVersion });
});

export default router;
