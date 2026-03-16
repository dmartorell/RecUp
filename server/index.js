import { config } from './config/env.js';
import express from 'express';
import { join } from 'path';
import { app, __dirname } from './app.js';

app.use(express.static(join(__dirname, '..', 'src')));

if (!config.anthropicApiKey) {
  console.warn('[WARN] ANTHROPIC_API_KEY no configurada — el endpoint /api/summarize no funcionara');
}
if (!config.clickupApiKey || !config.clickupListId) {
  console.warn('[WARN] CLICKUP_API_KEY o CLICKUP_LIST_ID no configuradas — los endpoints de ClickUp no funcionaran');
}

app.listen(config.port, () => {
  console.log(`recUp running on http://localhost:${config.port}`);
});
