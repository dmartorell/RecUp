import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import './db.js';
import summarizeRouter from './routes/summarize.js';
import ticketRouter from './routes/ticket.js';
import attachmentRouter from './routes/attachment.js';
import authRouter from './routes/auth.js';
import cardsRouter from './routes/cards.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(join(__dirname, '..', 'src')));
app.use(authRouter);
app.use(summarizeRouter);
app.use(ticketRouter);
app.use(attachmentRouter);
app.use(cardsRouter);

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('[WARN] ANTHROPIC_API_KEY no configurada — el endpoint /api/summarize no funcionara');
}
if (!process.env.CLICKUP_API_KEY || !process.env.CLICKUP_LIST_ID) {
  console.warn('[WARN] CLICKUP_API_KEY o CLICKUP_LIST_ID no configuradas — los endpoints de ClickUp no funcionaran');
}

app.listen(PORT, () => {
  console.log(`Bugshot running on http://localhost:${PORT}`);
});
