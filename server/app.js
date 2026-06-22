import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Sentry from '@sentry/node';
import express from 'express';
import './db.js';
import { errorHandler } from './middleware/errorHandler.js';
import attachmentRouter from './routes/attachment.js';
import authRouter from './routes/auth.js';
import incidentsRouter from './routes/incidents.js';
import settingsRouter from './routes/settings.js';
import summarizeRouter from './routes/summarize.js';
import ticketRouter from './routes/ticket.js';
import versionRouter from './routes/version.js';

export const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

app.set('trust proxy', 1);

app.use(express.json());
app.use(authRouter);
app.use(summarizeRouter);
app.use(ticketRouter);
app.use(versionRouter);
app.use(attachmentRouter);
app.use('/api/incidents', incidentsRouter);
app.use(settingsRouter);

Sentry.setupExpressErrorHandler(app);

app.use(errorHandler);

export { app };
