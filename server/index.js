import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import summarizeRouter from './routes/summarize.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(join(__dirname, '..', 'src')));
app.use(summarizeRouter);

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('[WARN] ANTHROPIC_API_KEY no configurada — el endpoint /api/summarize no funcionara');
}

app.listen(PORT, () => {
  console.log(`BugShot running on http://localhost:${PORT}`);
});
