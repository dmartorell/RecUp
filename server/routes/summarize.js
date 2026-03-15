import { Router } from 'express';

const router = Router();

const SYSTEM_PROMPT = `Eres un asistente tecnico que procesa transcripciones de reportes de bugs.
Dada una transcripcion de voz, determina si describe algun tipo de problema, incidencia, queja o situacion que requiera atencion. Se MUY permisivo: si el usuario menciona que algo no funciona, no aparece, esta roto, falta, esta mal, le sale un error, o cualquier situacion anomala, es un bug.

Si describe un problema (is_bug true), genera:
{"is_bug": true, "title": "titulo conciso (max 10 palabras)", "transcript": "transcripcion limpia y corregida", "bullets": ["punto clave 1", "punto clave 2"]}

Los bullets deben ser SOLO un resumen factual de lo que el usuario dijo. NO generes hipotesis, causas posibles, ni sugerencias de solucion. Limitate a extraer los hechos del reporte.

Ejemplo CORRECTO de bullets:
- "Usuario no puede iniciar sesion"
- "Todos los accesos estan bloqueados"
- "Funcion de login no operativa"

Ejemplo INCORRECTO (NUNCA hagas esto):
- "Posible interferencia electrica o problema de circuitos compartidos"

Solo responde is_bug false si el mensaje es claramente un saludo, prueba de microfono, contenido sin ninguna queja o problema:
{"is_bug": false, "transcript": "transcripcion limpia y corregida"}

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

  const SUMMARIZE_TIMEOUT_MS = 30_000;
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
      is_bug: parsed.is_bug ?? false,
      title: parsed.title || null,
      transcript: parsed.transcript,
      bullets: parsed.bullets || [],
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
