import { Router } from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/env.js';
import { CLAUDE_MODEL, CLAUDE_MAX_TOKENS, CLAUDE_TEMPERATURE, SUMMARIZE_TIMEOUT_MS } from '../config/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SYSTEM_PROMPT = readFileSync(join(__dirname, '..', 'config', 'prompts', 'summarize-system.txt'), 'utf-8');

const router = Router();

router.post('/api/summarize', async (req, res, next) => {
  const { transcript } = req.body;

  if (!transcript || !transcript.trim()) {
    return res.status(400).json({ error: 'TRANSCRIPT_REQUIRED' });
  }

  const apiKey = config.anthropicApiKey;
  if (!apiKey) {
    return res.status(500).json({ error: 'API_KEY_MISSING' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUMMARIZE_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: CLAUDE_MAX_TOKENS,
        temperature: CLAUDE_TEMPERATURE,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: transcript.trim() },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      await response.text();
      return res.status(response.status).json({ error: 'CLAUDE_API_ERROR' });
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text;

    if (!rawText) {
      return res.status(502).json({ error: 'EMPTY_RESPONSE' });
    }

    let parsed;
    try {
      const cleaned = rawText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(502).json({ error: 'INVALID_JSON' });
    }

    return res.json({
      is_bug: parsed.is_bug ?? false,
      title: parsed.title || null,
      transcript: parsed.transcript,
      bullets: parsed.bullets || [],
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'TIMEOUT' });
    }
    next(err);
  }
});

export default router;
