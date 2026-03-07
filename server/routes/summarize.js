import { Router } from 'express';

const router = Router();

const SYSTEM_PROMPT = `Eres un asistente tecnico que procesa transcripciones de reportes de bugs.
Dada una transcripcion de voz, genera un JSON con:
- "title": titulo conciso del problema (maximo 10 palabras)
- "transcript": transcripcion limpia y corregida gramaticalmente, sin muletillas ni repeticiones
- "bullets": array de 2-5 puntos clave del reporte (strings cortos y accionables)

Responde UNICAMENTE con JSON valido, sin texto adicional, sin markdown code blocks.`;

router.post('/api/summarize', async (req, res) => {
  const { transcript } = req.body;

  if (!transcript || !transcript.trim()) {
    return res.status(400).json({ error: 'transcript es obligatorio y no puede estar vacio' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY no esta configurada en el servidor' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        temperature: 0.3,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: transcript.trim() },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(response.status).json({
        error: `Claude API error (${response.status}): ${errorBody}`,
      });
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text;

    if (!rawText) {
      return res.status(502).json({ error: 'Respuesta vacia de Claude API' });
    }

    let parsed;
    try {
      const cleaned = rawText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(502).json({
        error: 'Claude devolvio JSON invalido',
        raw: rawText,
      });
    }

    return res.json({
      title: parsed.title,
      transcript: parsed.transcript,
      bullets: parsed.bullets,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Timeout: Claude API tardo mas de 30 segundos' });
    }
    return res.status(500).json({ error: `Error interno: ${err.message}` });
  }
});

export default router;
