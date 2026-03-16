import { config } from './config/env.js';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import './db.js';
import summarizeRouter from './routes/summarize.js';
import ticketRouter from './routes/ticket.js';
import attachmentRouter from './routes/attachment.js';
import authRouter from './routes/auth.js';
import incidentsRouter from './routes/incidents.js';
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(express.json());
app.use(express.static(join(__dirname, '..', 'src')));
app.use(authRouter);
app.use(summarizeRouter);
app.use(ticketRouter);
app.use(attachmentRouter);
app.use(incidentsRouter);
app.use(errorHandler);

if (!config.anthropicApiKey) {
  console.warn('[WARN] ANTHROPIC_API_KEY no configurada — el endpoint /api/summarize no funcionara');
}
if (!config.clickupApiKey || !config.clickupListId) {
  console.warn('[WARN] CLICKUP_API_KEY o CLICKUP_LIST_ID no configuradas — los endpoints de ClickUp no funcionaran');
}

app.listen(config.port, () => {
  console.log(`recUp running on http://localhost:${config.port}`);
});
