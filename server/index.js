import express from 'express';
import { join } from 'path';
import { __dirname, app } from './app.js';
import { config } from './config/env.js';
import { initDb } from './db.js';

app.use(express.static(join(__dirname, '..', 'src')));

await initDb();

app.listen(config.port, () => {
  console.log(`recUp running on http://localhost:${config.port}`);
});
