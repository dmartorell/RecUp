import { Router } from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { authMiddleware } from '../middleware/auth.js';
import { getUserSettings } from '../db.js';
import { CLAUDE_MODEL, CLAUDE_MAX_TOKENS, CLAUDE_TEMPERATURE, SUMMARIZE_TIMEOUT_MS, OPENAI_MODEL, OPENAI_MAX_TOKENS, OPENAI_TEMPERATURE } from '../config/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SYSTEM_PROMPT = readFileSync(join(__dirname, '..', 'config', 'prompts', 'summarize-system.txt'), 'utf-8');

const router = Router();

router.post('/api/summarize', authMiddleware, async (req, res, next) => {
  const { transcript } = req.body;

  if (!transcript || !transcript.trim()) {
    return res.status(400).json({ error: 'TRANSCRIPT_REQUIRED' });
  }

  const settings = await getUserSettings(req.user.id);
  const provider = settings.ai_provider || 'anthropic';

  const apiKey = provider === 'openai' ? settings.openai_api_key : settings.anthropic_api_key;
  if (!apiKey) {
    return res.status(400).json({ error: 'SETTINGS_NOT_CONFIGURED' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUMMARIZE_TIMEOUT_MS);

  try {
    let response;
    if (provider === 'openai') {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          max_tokens: OPENAI_MAX_TOKENS,
          temperature: OPENAI_TEMPERATURE,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: transcript.trim() },
          ],
        }),
        signal: controller.signal,
      });
    } else {
      response = await fetch('https://api.anthropic.com/v1/messages', {
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
    }

    clearTimeout(timeout);

    if (!response.ok) {
      await response.text();
      return res.status(response.status).json({ error: 'AI_API_ERROR' });
    }

    const data = await response.json();
    const rawText = provider === 'openai'
      ? data.choices?.[0]?.message?.content
      : data.content?.[0]?.text;

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
