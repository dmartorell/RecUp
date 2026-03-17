import express from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import './db.js';
import summarizeRouter from './routes/summarize.js';
import ticketRouter from './routes/ticket.js';
import attachmentRouter from './routes/attachment.js';
import authRouter from './routes/auth.js';
import incidentsRouter from './routes/incidents.js';
import settingsRouter from './routes/settings.js';
import { errorHandler } from './middleware/errorHandler.js';

export const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(express.json());
app.use(authRouter);
app.use(summarizeRouter);
app.use(ticketRouter);
app.use(attachmentRouter);
app.use('/api/incidents', incidentsRouter);
app.use(settingsRouter);
app.use(errorHandler);

export { app };
