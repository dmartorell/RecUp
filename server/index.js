import { config } from './config/env.js';
import express from 'express';
import { join } from 'path';
import { initDb } from './db.js';
import { app, __dirname } from './app.js';

app.use(express.static(join(__dirname, '..', 'src')));

await initDb();

app.listen(config.port, () => {
  console.log(`recUp running on http://localhost:${config.port}`);
});
