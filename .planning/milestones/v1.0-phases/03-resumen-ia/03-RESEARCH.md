# Phase 3: Resumen IA - Research

**Researched:** 2026-03-07
**Domain:** Anthropic Claude Messages API + Express proxy + card UI
**Confidence:** HIGH

## Summary

Esta fase requiere 3 piezas: un endpoint Express que haga proxy a la API de Claude, un prompt que genere titulo + transcripcion limpia + bullets desde la transcripcion cruda, y la actualizacion de las cards del feed para mostrar estados (Processing/Completed/Error) con el resultado estructurado.

El stack es minimalista: `fetch` nativo de Bun para llamar a la API de Anthropic (sin SDK), Express para la ruta POST, y vanilla JS para actualizar el DOM. Claude Haiku 4.5 (`claude-haiku-4-5`) cuesta $1/MTok input y $5/MTok output, ideal para resumenes cortos.

**Recomendacion principal:** Usar la Messages API directamente con `fetch` (sin `@anthropic-ai/sdk`), respuesta completa (no streaming), y JSON estructurado en la respuesta de Claude.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Claude genera 3 outputs: titulo sugerido, transcripcion limpia con puntuacion inteligente, bullets de resumen
- Bullets libres (sin estructura fija tipo bug report), contenido adaptativo
- Numero de bullets adaptativo segun duracion/contenido de la grabacion
- Respuesta en JSON estructurado: `{ title, transcript, bullets[] }`
- Sin metadatos extra (categoria, prioridad) — eso es fase 4
- Al parar la grabacion, la card se crea automaticamente con la transcripcion cruda y estado "Processing" con spinner
- Badge en header: tipo (Audio/Video) + estado (Processing/Completed)
- Cuando Claude responde: la transcripcion cruda se reemplaza por la limpia, aparecen los bullets, estado cambia a Completed
- Boton "Crear Ticket" visible pero inactivo/deshabilitado (se activa en fase 4)
- Si Claude falla: estado "Error" + boton "Reintentar". La transcripcion cruda se mantiene
- Si la transcripcion esta vacia (no se detecto voz): card con mensaje "No se detecto voz", sin llamar a Claude
- La card del feed es de solo lectura — toda la edicion ocurre en el modal de crear ticket (fase 4)
- RESU-03 se cumple via el modal de fase 4, no en esta fase
- Idioma: siempre en espanol
- Tono: tecnico conciso, tipo ticket de soporte
- Prompt generico, sin contexto de dominio especifico
- Modelo: Claude Haiku (rapido, barato, suficiente para resumir transcripciones)
- Respuesta completa (no streaming) — con Haiku la espera es ~1-2s, aceptable
- Sin limite explicito de duracion de grabacion ni longitud de transcripcion para v1

### Claude's Discretion
- Diseno exacto del prompt (system + user)
- Estructura interna del endpoint /api/summarize
- Manejo de errores HTTP y timeouts
- Diseno visual del spinner y estados de la card

### Deferred Ideas (OUT OF SCOPE)
- Selector de App obligatorio (alfredSmart, lavidda, nunezNavarro, verticalsDemo) — fase 4
- Selector de Area funcional — fase 4
- Campos manuales: username, projectId, assetId — fase 4
- Contexto de dominio en el prompt — valorar en futuro
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RESU-01 | Endpoint /api/summarize proxy a Claude API | Messages API verificada: POST a `https://api.anthropic.com/v1/messages`, headers `x-api-key` + `anthropic-version`, modelo `claude-haiku-4-5` |
| RESU-02 | Claude genera titulo + bullets estructurados a partir de la transcripcion | Prompt con system message en espanol, respuesta JSON `{ title, transcript, bullets[] }`, `max_tokens: 1024` suficiente |
| RESU-03 | Usuario puede editar titulo y descripcion antes de crear ticket | Diferido a fase 4 por decision del usuario — la card del feed es solo lectura, edicion en modal de ticket |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Anthropic Messages API | v1 (2023-06-01) | Generar resumen desde transcripcion | API directa, sin SDK necesario |
| claude-haiku-4-5 | 20251001 | Modelo LLM | $1/$5 MTok, ~1-2s latencia, suficiente para resumenes |
| Express (existente) | ^4.21.0 | Ruta POST /api/summarize | Ya instalado en el proyecto |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fetch (nativo Bun) | built-in | HTTP client para llamar a Anthropic | No necesita instalacion |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| fetch nativo | @anthropic-ai/sdk | SDK anade dependencia innecesaria para una sola llamada API |
| claude-haiku-4-5 | claude-sonnet-4-6 | 3x mas caro, mas lento, innecesario para resumenes cortos |

**Installation:**
```bash
# No se necesitan dependencias nuevas. Solo anadir ANTHROPIC_API_KEY al .env
```

## Architecture Patterns

### Estructura de archivos (cambios)
```
server/
├── index.js             # Importar nueva ruta
└── routes/
    └── summarize.js     # POST /api/summarize (NUEVO)
src/
├── js/
│   ├── app.js           # Extender createCard(), anadir summarize flow
│   └── summarizer.js    # Modulo fetch a /api/summarize (NUEVO)
└── css/
    └── styles.css       # Estilos para badges, spinner, estados
```

### Pattern 1: Express Proxy a Claude API
**Que:** Ruta Express que recibe transcripcion, llama a Claude, devuelve JSON estructurado.
**Cuando:** Siempre — nunca exponer API key en frontend.

```javascript
// server/routes/summarize.js
import { Router } from 'express';
const router = Router();

router.post('/api/summarize', async (req, res) => {
  const { transcript } = req.body;

  if (!transcript?.trim()) {
    return res.status(400).json({ error: 'Transcripcion vacia' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        system: '...system prompt...',
        messages: [{ role: 'user', content: transcript }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: err.error?.message || 'Error de Claude API'
      });
    }

    const data = await response.json();
    const text = data.content[0].text;
    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
```

### Pattern 2: Modulo Frontend Summarizer
**Que:** Modulo JS que llama al endpoint proxy y devuelve el resultado parseado.

```javascript
// src/js/summarizer.js
export async function summarize(transcript) {
  const res = await fetch('/api/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(err.error);
  }

  return res.json(); // { title, transcript, bullets }
}
```

### Pattern 3: Card con estados (Processing → Completed → Error)
**Que:** La card muestra estado actual con badge y spinner, se actualiza async cuando Claude responde.

```javascript
// Flujo en app.js createCard():
// 1. Crear card con transcripcion cruda + badge "Processing" + spinner
// 2. Si transcripcion vacia → mostrar "No se detecto voz", no llamar a Claude
// 3. Llamar a summarize(transcript) async
// 4. Si OK → reemplazar texto con transcripcion limpia, mostrar bullets, badge "Completed"
// 5. Si error → badge "Error" + boton "Reintentar"
```

### Anti-Patterns a evitar
- **Exponer ANTHROPIC_API_KEY en frontend:** Siempre usar proxy server
- **Asumir que Claude siempre devuelve JSON valido:** Parsear con try/catch, tener fallback
- **Bloquear UI durante la llamada API:** La card debe mostrar estado "Processing" inmediatamente, la llamada es async
- **No manejar transcripcion vacia:** Verificar antes de llamar a Claude, ahorrar tokens

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP client para API calls | XMLHttpRequest wrapper | fetch nativo (Bun server + browser) | Soportado nativamente en ambos entornos |
| Parsing JSON de Claude | Regex extraction | JSON.parse con try/catch + fallback | Claude con prompt adecuado devuelve JSON limpio |
| Spinner CSS | JS animation | CSS @keyframes animation | Mas eficiente, no bloquea main thread |

## Common Pitfalls

### Pitfall 1: Claude no devuelve JSON valido
**Que pasa:** Claude puede anadir texto antes/despues del JSON, o devolver markdown.
**Causa:** Prompt no explicita suficientemente el formato.
**Solucion:** System prompt con instruccion explicita: "Responde UNICAMENTE con JSON valido, sin texto adicional, sin markdown code blocks." Parsear con try/catch.
**Deteccion:** `JSON.parse()` lanza error — mostrar estado "Error" en la card.

### Pitfall 2: ANTHROPIC_API_KEY no configurada
**Que pasa:** El servidor arranca pero /api/summarize falla con 401.
**Causa:** .env tiene `ANTHROPIC_API_KEY=` vacio.
**Solucion:** Validar al arrancar el servidor que la key existe. En el endpoint, verificar antes de llamar.
**Deteccion:** Log de warning al inicio si la key esta vacia.

### Pitfall 3: Timeout en llamadas a Claude
**Que pasa:** La conexion se cuelga si Anthropic tarda.
**Causa:** fetch sin timeout por defecto.
**Solucion:** Usar `AbortController` con timeout de 30s. Haiku normalmente responde en 1-2s, asi que 30s es generoso.

### Pitfall 4: Transcripcion cruda sin puntuacion
**Que pasa:** Web Speech API devuelve texto sin puntuacion (o con puntuacion pobre).
**Causa:** Limitacion de Web Speech API.
**Solucion:** Es exactamente lo que hace esta fase — Claude limpia la transcripcion y anade puntuacion inteligente.

### Pitfall 5: Card data perdida al actualizar
**Que pasa:** Los datos del resumen (title, transcript, bullets) solo estan en el DOM, se pierden al refrescar.
**Causa:** No hay persistencia — aceptable para v1 (sin persistencia de sesiones, segun Out of Scope).
**Solucion:** No es un problema en v1 — el flujo es grabar → resumir → crear ticket en una sesion.

## Code Examples

### System Prompt recomendado
```javascript
const SYSTEM_PROMPT = `Eres un asistente que convierte transcripciones de voz en resúmenes estructurados para tickets de soporte técnico.

Recibirás una transcripción cruda (sin puntuación, posiblemente con errores de reconocimiento de voz).

Debes generar:
1. "title": Un título conciso que describa el problema o tema (máximo 80 caracteres)
2. "transcript": La transcripción original limpia con puntuación correcta y formato legible
3. "bullets": Un array de puntos clave que resuman la información relevante

Reglas:
- Idioma: siempre español
- Tono: técnico y conciso, como un ticket de soporte ("El campo X no muestra el valor introducido")
- Número de bullets: adaptativo según el contenido (mínimo 1, máximo 7)
- No inventes información que no esté en la transcripción
- Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown code blocks

Formato de respuesta:
{"title":"...","transcript":"...","bullets":["...",  "..."]}`;
```

### Estructura de respuesta esperada de Claude
```json
{
  "title": "Error en campo de temperatura del termostato",
  "transcript": "Estoy en la app de Alfred Smart y cuando voy al termostato del salón, el campo de temperatura no muestra el valor que he introducido. Lo pongo a 22 grados pero sigue mostrando 18.",
  "bullets": [
    "El campo de temperatura del termostato no refleja el valor introducido por el usuario",
    "Se reproduce en el termostato del salón dentro de la app Alfred Smart",
    "El usuario introduce 22°C pero la interfaz sigue mostrando 18°C"
  ]
}
```

### Llamada a Claude API desde el servidor
```javascript
// Headers requeridos (verificado en docs oficiales)
const headers = {
  'x-api-key': process.env.ANTHROPIC_API_KEY,
  'anthropic-version': '2023-06-01',
  'content-type': 'application/json',
};

// Body minimo requerido
const body = {
  model: 'claude-haiku-4-5',
  max_tokens: 1024,
  system: SYSTEM_PROMPT,
  messages: [{ role: 'user', content: transcript }],
  temperature: 0.3, // Baja para respuestas consistentes
};
```

### Estructura HTML de la card actualizada
```html
<!-- Card con estado Processing -->
<div class="card" data-status="processing">
  <div class="card-header">
    <div class="card-badges">
      <span class="badge badge-audio">Audio</span>
      <span class="badge badge-processing">Processing</span>
    </div>
    <span class="card-time">14:32 · 01:15</span>
    <button class="card-delete">&times;</button>
  </div>
  <div class="card-body">
    <p class="card-text">transcripcion cruda aqui...</p>
    <div class="card-spinner"><!-- CSS spinner --></div>
  </div>
</div>

<!-- Card con estado Completed -->
<div class="card" data-status="completed">
  <div class="card-header">
    <div class="card-badges">
      <span class="badge badge-audio">Audio</span>
      <span class="badge badge-completed">Completed</span>
    </div>
    <span class="card-time">14:32 · 01:15</span>
    <button class="card-delete">&times;</button>
  </div>
  <div class="card-body">
    <h3 class="card-title">Titulo generado por Claude</h3>
    <p class="card-text">Transcripcion limpia con puntuacion...</p>
    <ul class="card-bullets">
      <li>Bullet 1</li>
      <li>Bullet 2</li>
    </ul>
  </div>
  <div class="card-footer">
    <button class="btn-create-ticket" disabled>Crear Ticket</button>
  </div>
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| claude-3-haiku-20240307 | claude-haiku-4-5 | Oct 2025 | Haiku 3 deprecado (retiro Abr 2026), Haiku 4.5 es el modelo rapido actual |
| anthropic-version: 2023-01-01 | anthropic-version: 2023-06-01 | Jun 2023 | Version estable actual del API |
| @anthropic-ai/sdk obligatorio | fetch nativo suficiente | Siempre | Para una sola llamada, el SDK es overhead innecesario |

**Deprecado:**
- `claude-3-haiku-20240307`: Deprecado, retiro programado para Abril 2026. Usar `claude-haiku-4-5`.

## Open Questions

1. **Temperatura optima para resumenes**
   - Lo que sabemos: 0.0-0.3 produce respuestas mas consistentes y deterministas
   - Lo que no esta claro: El punto exacto optimo para resumenes de soporte
   - Recomendacion: Usar 0.3 como default, ajustar empiricamente si los resumenes son demasiado rigidos

2. **Limite de tokens de entrada**
   - Lo que sabemos: Haiku 4.5 soporta 200K tokens de contexto
   - Lo que no esta claro: Longitud maxima realista de una transcripcion de voz (probablemente <2K tokens)
   - Recomendacion: No limitar en v1, pero loguear longitud de transcripcion para monitorizar

## Sources

### Primary (HIGH confidence)
- [Anthropic Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview) - Modelos, precios, IDs verificados
- [Anthropic Messages API](https://platform.claude.com/docs/en/api/messages) - Endpoint, headers, request/response structure

### Secondary (MEDIUM confidence)
- Ninguna - toda la informacion viene de docs oficiales

### Tertiary (LOW confidence)
- Ninguna

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - API documentada oficialmente, modelo y precios verificados
- Architecture: HIGH - Patron proxy Express trivial, fetch nativo en Bun confirmado
- Pitfalls: HIGH - Basado en experiencia con la API de Anthropic y el codigo existente del proyecto

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (API estable, modelo no cambiara a corto plazo)
