# Stack Research

**Domain:** Internal tool — media capture + transcription + AI summarization + ticket creation
**Researched:** 2026-03-07
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 22.x LTS (Jod) | Runtime | Active LTS hasta abril 2027. v20 entra en EOL abril 2026 — no vale la pena. |
| Express | 5.x (~5.2) | HTTP server + API proxy | v5 ya es default en npm. Async error handling nativo, drop de APIs deprecadas. Sin razones para quedarse en v4. |
| @anthropic-ai/sdk | latest (~0.39+) | Claude API client | SDK oficial de Anthropic. Tipado TypeScript, manejo de streams, retry automático. No usar fetch manual. |

### Browser APIs (sin instalacion)

| API | Purpose | Soporte | Notas criticas |
|-----|---------|---------|----------------|
| MediaRecorder | Grabar audio/video/pantalla como webm | Chrome, Edge, Firefox, Safari 14.5+ | Safari 18.4+ soporta webm. iOS ya funciona. |
| getUserMedia | Acceso a camara + micro | Todos los navegadores modernos | Requiere HTTPS o localhost. |
| getDisplayMedia | Captura de pantalla | Chrome, Edge, Firefox. Safari parcial. | Combinar con getUserMedia para audio del micro. |
| Web Speech API (SpeechRecognition) | Transcripcion en tiempo real | **Solo Chromium** (Chrome, Edge). Firefox NO. Safari parcial. | Limitacion critica — ver seccion de pitfalls. Soporta `es-ES`. |

### Supporting Libraries (Backend)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dotenv | 17.x | Variables de entorno desde .env | Siempre. Cargar ANTHROPIC_API_KEY, CLICKUP_API_KEY, etc. |
| cors | 2.8.x | CORS headers | Solo si frontend y backend corren en puertos distintos durante desarrollo. |
| multer | 2.x | Parse multipart/form-data | Para recibir archivos del frontend (fotos/videos) antes de reenviarlos a ClickUp. |
| form-data | 4.x | Construir multipart requests | Para enviar archivos a ClickUp Attachments API desde el backend. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| nodemon | Auto-restart en desarrollo | `npx nodemon server.js` — no necesita instalacion global. |
| node --env-file | Alternativa a dotenv nativa en Node 22+ | Si se prefiere zero-dependencies: `node --env-file=.env server.js`. Elimina necesidad de dotenv. |

## Installation

```bash
# Core
npm install express @anthropic-ai/sdk

# File handling (para uploads a ClickUp)
npm install multer form-data

# Environment (elegir UNO)
npm install dotenv
# O usar Node 22 nativo: node --env-file=.env server.js

# Dev dependencies
npm install -D nodemon
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Express 5.x | Fastify | Si necesitas rendimiento extremo. Para un prototipo interno, Express es mas que suficiente y tiene mas documentacion. |
| @anthropic-ai/sdk | fetch manual a API | Nunca. El SDK maneja retries, rate limits, streaming y tipado. fetch manual es mas codigo y mas bugs. |
| Web Speech API | Whisper API (OpenAI) | Si necesitas soporte Firefox, transcripcion offline, o mayor precision. Cuesta dinero y necesita enviar audio al servidor. Para prototipo Chromium-only, Web Speech API es gratis y en tiempo real. |
| multer | busboy | Si no quieres la abstraccion de multer. Multer esta construido sobre busboy y es mas ergonomico con Express. |
| dotenv | node --env-file | En Node 22+, --env-file es nativo y elimina la dependencia. Usar si se quiere zero-deps. No soporta interpolacion de variables. |
| HTML/JS estatico | React/Vue/Svelte | Nunca para este prototipo. Framework SPA anade build step, complejidad y tiempo sin beneficio para una tool interna simple. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| axios | Express 5 + Node 22 tienen fetch nativo global. Axios anade 400KB de dependencia innecesaria. | `fetch()` nativo (Node 22+) o `form-data` + `fetch` para multipart. |
| Socket.IO / WebSockets | No hay caso de uso de tiempo real server-push. La transcripcion ocurre en el browser. | Nada — no necesitas comunicacion bidireccional. |
| TypeScript | Anade build step y complejidad. Para un prototipo interno con HTML estatico, JS plano es mas rapido de iterar. | JavaScript plano (.js) con JSDoc si quieres autocompletado. |
| MongoDB/PostgreSQL | No hay datos que persistir. Todo va a ClickUp. | Sin base de datos. El backend es stateless proxy. |
| webpack/vite/parcel | Sin framework frontend, sin imports ES modules complejos, sin build step necesario. | `express.static('public')` sirve los archivos directamente. |
| Whisper (para v1) | Anade coste, latencia, y complejidad server-side. Web Speech API es gratis y en tiempo real. | Web Speech API. Evaluar Whisper solo si Firefox es requisito. |

## Stack Patterns by Variant

**Si los usuarios usan Chrome/Edge (caso probable para empresa):**
- Web Speech API funciona perfectamente
- SpeechRecognition con `lang: 'es-ES'` para transcripcion en espanol
- Sin dependencias extra

**Si se necesita soporte Firefox en el futuro:**
- Anadir Whisper API como fallback server-side
- Frontend detecta soporte: `'webkitSpeechRecognition' in window`
- Si no hay soporte, graba audio y envia al backend para transcripcion

**Si los archivos son muy grandes (>100MB de video):**
- Considerar comprimir en el browser antes de enviar (MediaRecorder ya comprime a webm)
- ClickUp permite hasta 1GB por attachment, asi que no deberia ser problema

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Express 5.x | Node.js >= 18 | Express 5 requiere Node 18+. Con Node 22 LTS no hay problema. |
| @anthropic-ai/sdk | Node.js >= 18 | Usa fetch nativo, requiere Node 18+. |
| multer 2.x | Express 5.x | Multer 2.x es compatible con Express 5. |
| Web Speech API | Chrome 33+, Edge 79+ | Requiere HTTPS en produccion. localhost funciona sin HTTPS. |
| MediaRecorder (webm) | Chrome, Firefox, Safari 18.4+ | Safari antiguo produce mp4 en lugar de webm — manejar ambos MIME types. |

## Browser Compatibility Matrix

| Feature | Chrome | Edge | Firefox | Safari (desktop) | Safari (iOS) |
|---------|--------|------|---------|-------------------|--------------|
| MediaRecorder | SI | SI | SI | SI (14.5+) | SI (14.5+) |
| webm output | SI | SI | SI | SI (18.4+) | SI (18.4+) |
| getUserMedia | SI | SI | SI | SI | SI |
| getDisplayMedia | SI | SI | SI | Parcial | NO |
| Web Speech API | SI | SI | **NO** | Parcial | Parcial |

**Conclusion de compatibilidad:** El factor limitante es **Web Speech API**, que solo funciona fiablemente en Chromium (Chrome/Edge). Para un prototipo interno donde se puede exigir Chrome, esto es aceptable. Documentar requisito de Chrome en la UI.

## Integration Points

### Frontend -> Backend
- `POST /api/summarize` — Envia transcripcion, recibe resumen de Claude
- `POST /api/clickup/task` — Crea tarea en ClickUp
- `POST /api/clickup/task/:id/attachment` — Sube archivo a tarea existente

### Backend -> APIs externas
- **Claude API:** `@anthropic-ai/sdk` — messages.create() con modelo claude-sonnet-4-5-20250929
- **ClickUp Create Task:** `POST https://api.clickup.com/api/v2/list/{list_id}/task`
- **ClickUp Attachment:** `POST https://api.clickup.com/api/v2/task/{task_id}/attachment` (multipart/form-data)

### Flujo de attachment critico
1. Frontend graba video/audio -> blob webm
2. Frontend envia blob al backend via FormData
3. Backend recibe con multer (memory storage, no disco)
4. Backend reenvia a ClickUp con form-data library
5. ClickUp devuelve URL del attachment

## Dependencies Count

**Total: 5 production deps + 1 dev dep.** Stack minimalista apropiado para prototipo.

## Sources

- [Node.js Releases](https://nodejs.org/en/about/previous-releases) — Node 22 LTS status verified
- [Express 5.1.0 announcement](https://expressjs.com/2025/03/31/v5-1-latest-release.html) — Express 5 now default on npm
- [npm: @anthropic-ai/sdk](https://www.npmjs.com/package/@anthropic-ai/sdk) — Anthropic SDK versions
- [MDN: Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) — Browser compatibility
- [Can I Use: Speech Recognition](https://caniuse.com/speech-recognition) — Chromium-only confirmation
- [MDN: SpeechRecognition.lang](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/lang) — es-ES support verified
- [Can I Use: MediaRecorder](https://caniuse.com/mediarecorder) — Cross-browser support
- [ClickUp API: Create Task Attachment](https://developer.clickup.com/reference/createtaskattachment) — Multipart upload requirements
- [npm: multer](https://www.npmjs.com/package/multer) — v2.x latest
- [npm: cors](https://www.npmjs.com/package/cors) — v2.8.6 latest
- [npm: dotenv](https://www.npmjs.com/package/dotenv) — v17.x latest, vs node --env-file alternative

---
*Stack research for: BugShot — internal media capture + AI ticket creation tool*
*Researched: 2026-03-07*
