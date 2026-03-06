# Architecture Research

**Domain:** Internal bug reporting webapp (recording + transcription + AI summary + ticket creation)
**Researched:** 2026-03-07
**Confidence:** HIGH

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     BROWSER (Client)                            │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Recording    │  │ Transcription│  │ UI Controller        │  │
│  │ Module       │  │ Module       │  │ (state + DOM)        │  │
│  │ MediaRecorder│  │ Web Speech   │  │                      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│         └────────┬────────┘                      │              │
│                  │                               │              │
│         ┌────────▼────────┐              ┌───────▼──────────┐  │
│         │ MediaStream     │              │ API Client       │  │
│         │ (shared source) │              │ (fetch wrapper)  │  │
│         └─────────────────┘              └───────┬──────────┘  │
│                                                  │              │
├──────────────────────────────────────────────────┼──────────────┤
│                                                  │              │
│                     EXPRESS SERVER                │              │
│                                                  │              │
│  ┌─────────────────┐  ┌──────────────────────────▼───────────┐ │
│  │ Static Files    │  │ API Proxy Routes                     │ │
│  │ (public/)       │  │                                      │ │
│  │                 │  │  POST /api/summarize → Claude API    │ │
│  │                 │  │  POST /api/ticket    → ClickUp API   │ │
│  │                 │  │  POST /api/attachment → ClickUp API  │ │
│  └─────────────────┘  └──────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────┐          ┌─────────────────────┐
│ Claude API      │          │ ClickUp API v2      │
│ Messages        │          │ Tasks + Attachments  │
└─────────────────┘          └─────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| Recording Module | Captura audio/video/pantalla via MediaRecorder | Clase JS que abstrae los 3 modos de grabacion |
| Transcription Module | Transcripcion en tiempo real via Web Speech API | SpeechRecognition corriendo en paralelo al recording |
| UI Controller | Estado de la app, manipulacion DOM, flujo del usuario | Vanilla JS, patron estado simple (objeto estado + render) |
| API Client | Comunicacion con el backend Express | Modulo fetch wrapper con manejo de errores |
| Static Files | Servir HTML/CSS/JS al browser | express.static('public') |
| API Proxy Routes | Reenviar peticiones a APIs externas ocultando keys | Express routes con axios/fetch hacia Claude y ClickUp |

## Recommended Project Structure

```
bugshot/
├── server/
│   ├── index.js              # Entry point: Express app config + listen
│   ├── routes/
│   │   ├── summarize.js      # POST /api/summarize → Claude API
│   │   ├── ticket.js         # POST /api/ticket → ClickUp API
│   │   └── attachment.js     # POST /api/attachment → ClickUp API
│   └── middleware/
│       └── error-handler.js  # Manejo centralizado de errores
├── public/
│   ├── index.html            # SPA: pagina unica
│   ├── css/
│   │   └── styles.css        # Estilos (mobile-first)
│   └── js/
│       ├── app.js            # Entry point: inicializa modulos, estado global
│       ├── recorder.js       # MediaRecorder: audio, video, pantalla
│       ├── transcriber.js    # Web Speech API: transcripcion en tiempo real
│       ├── api.js            # Fetch wrapper: llamadas al backend
│       └── ui.js             # Manipulacion DOM, render segun estado
├── .env                      # CLAUDE_API_KEY, CLICKUP_API_KEY, CLICKUP_LIST_ID
├── .env.example              # Plantilla sin valores
├── package.json
└── .gitignore
```

### Structure Rationale

- **server/routes/:** Un archivo por endpoint proxy. Cada ruta es independiente y testeable. Evita un server.js monolitico.
- **public/js/:** Modulos separados por responsabilidad. Sin bundler (prototipo). Usa ES modules nativos (`type="module"` en script tags).
- **Sin carpeta models/db/:** No hay persistencia propia. Todo pasa por APIs externas.

## Architectural Patterns

### Pattern 1: Proxy Pass-Through (Backend)

**What:** Express recibe la peticion del frontend, inyecta credenciales de .env, y reenvia a la API externa. La respuesta se devuelve tal cual al frontend.
**When to use:** Siempre que el frontend necesite hablar con APIs que requieren keys secretas.
**Trade-offs:** Sencillo y seguro. Anade latencia minima (~10-20ms). El backend no transforma datos, solo reenvia.

```javascript
// server/routes/summarize.js
import { Router } from 'express';
const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: req.body.transcript }]
      })
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
```

### Pattern 2: Dual-Stream Capture (Frontend)

**What:** Un unico MediaStream del microfono alimenta simultaneamente MediaRecorder (graba el archivo) y SpeechRecognition (transcribe en vivo). No son el mismo stream — SpeechRecognition usa su propio canal interno del browser.
**When to use:** Siempre en los 3 modos de grabacion.
**Trade-offs:** Funciona bien en Chrome desktop. En Chrome Android, SpeechRecognition y MediaRecorder pueden entrar en conflicto por el acceso al microfono (ver Pitfalls). Safari tiene soporte limitado de Web Speech API.

```javascript
// Patron: iniciar grabacion + transcripcion en paralelo
async function startRecording(mode) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: mode === 'video' });

  // Track 1: Grabacion
  const recorder = new MediaRecorder(stream);
  recorder.start();

  // Track 2: Transcripcion (usa su propio canal de audio)
  const recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'es-ES';
  recognition.onresult = (event) => { /* actualizar UI con texto */ };
  recognition.start();

  return { recorder, recognition, stream };
}
```

### Pattern 3: Multipart File Forward (Backend)

**What:** Frontend envia archivo como FormData. Express lo recibe con multer, luego lo reenvia a ClickUp como multipart/form-data.
**When to use:** Para adjuntar grabaciones/fotos a tickets de ClickUp.
**Trade-offs:** Requiere almacenamiento temporal en memoria (multer memoryStorage). Para archivos grandes (>100MB), considerar streaming.

```javascript
// server/routes/attachment.js
import { Router } from 'express';
import multer from 'multer';
import FormData from 'form-data';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.post('/:taskId', upload.single('attachment'), async (req, res, next) => {
  try {
    const form = new FormData();
    form.append('attachment', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    const response = await fetch(
      `https://api.clickup.com/api/v2/task/${req.params.taskId}/attachment`,
      {
        method: 'POST',
        headers: {
          'Authorization': process.env.CLICKUP_API_KEY,
          ...form.getHeaders()
        },
        body: form
      }
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
```

## Data Flow

### Flow Principal: Grabacion a Ticket

```
[1. Usuario pulsa "Grabar"]
        │
        ├── MediaRecorder.start()     → graba audio/video en chunks (Blob)
        └── SpeechRecognition.start() → transcribe audio a texto en vivo
                │
                ▼
[2. Usuario ve transcripcion en tiempo real en la UI]
        │
        ▼
[3. Usuario pulsa "Parar"]
        │
        ├── MediaRecorder.stop()      → genera Blob final (webm/mp4)
        └── SpeechRecognition.stop()  → transcripcion completa
                │
                ▼
[4. Usuario revisa transcripcion, puede editar]
        │
        ▼
[5. Usuario pulsa "Resumir"]
        │
        └── POST /api/summarize { transcript: "texto completo" }
                │
                ▼
            Express → Claude API → respuesta con resumen estructurado
                │
                ▼
[6. UI muestra resumen + campos editables del ticket]
        │  (nombre tarea, descripcion, username, projectId, assetId)
        │
        ▼
[7. Usuario pulsa "Crear Ticket"]
        │
        └── POST /api/ticket { name, description, custom_fields, ... }
                │
                ▼
            Express → ClickUp Create Task API → devuelve task_id
                │
                ▼
[8. Adjuntar evidencia automaticamente]
        │
        └── POST /api/attachment/:taskId  (FormData con archivo grabado)
                │
                ▼
            Express → ClickUp Attachment API → confirmacion
                │
                ▼
[9. UI muestra "Ticket creado" con enlace a ClickUp]
```

### Key Data Flows

1. **Audio a Transcripcion (client-side):** MediaStream → SpeechRecognition → eventos onresult → texto acumulado en variable. No pasa por el servidor.
2. **Transcripcion a Resumen:** Texto plano → POST /api/summarize → Claude API → JSON con resumen estructurado → UI.
3. **Resumen a Ticket:** Campos editados por usuario → POST /api/ticket → ClickUp API → task_id devuelto → usado para adjuntar archivo.
4. **Archivo a ClickUp:** Blob del MediaRecorder → FormData en frontend → POST /api/attachment/:taskId → multer en Express → FormData reconstruido → ClickUp Attachments API.

### State Management

```
appState = {
  mode: 'audio' | 'video' | 'screen',     // modo de grabacion seleccionado
  phase: 'idle' | 'recording' | 'review' | 'summarizing' | 'editing' | 'creating' | 'done',
  transcript: '',                           // texto acumulado
  interimTranscript: '',                    // texto parcial (en progreso)
  recordedBlob: null,                       // Blob del archivo grabado
  summary: null,                            // respuesta de Claude
  ticketFields: { name, description, ... }, // campos editables
  taskId: null,                             // ID del ticket creado
  error: null                               // mensaje de error actual
}
```

El estado es un objeto plano. Cambios al estado disparan re-render de las secciones afectadas de la UI. Sin framework reactivo -- manipulacion DOM directa basada en `phase`.

## Integration Points

### External Services

| Service | Endpoint | Method | Content-Type | Auth | Notes |
|---------|----------|--------|-------------|------|-------|
| Claude API | `/v1/messages` | POST | application/json | `x-api-key` header | Modelo configurable. System prompt define formato del resumen. |
| ClickUp Tasks | `/api/v2/list/{list_id}/task` | POST | application/json | `Authorization` header | list_id desde .env. Custom fields para username, projectId, assetId. |
| ClickUp Attachments | `/api/v2/task/{task_id}/attachment` | POST | multipart/form-data | `Authorization` header | Limite 1GB. Requiere task_id del paso anterior. Operacion secuencial obligatoria. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Frontend JS modules | Import/export ES modules | Cada modulo exporta funciones puras o clases. app.js orquesta. |
| Frontend → Backend | fetch() con JSON o FormData | Solo 3 endpoints. No hay WebSocket ni SSE. |
| Backend routes | Express Router independientes | Cada route file se monta en server/index.js. No comparten estado. |

### ClickUp API: Two-Step Ticket Creation

La creacion de tickets con adjuntos requiere **dos llamadas secuenciales**:

1. **Crear tarea** → obtener `task_id`
2. **Subir adjunto** usando el `task_id` obtenido

No hay forma de crear tarea + adjunto en una sola llamada. El frontend debe orquestar esta secuencia y manejar fallos parciales (tarea creada pero adjunto fallido).

## Anti-Patterns

### Anti-Pattern 1: Exponer API keys en el frontend

**What people do:** Llamar a Claude o ClickUp directamente desde el JavaScript del browser.
**Why it's wrong:** Las keys son visibles en DevTools. Cualquier empleado podria extraerlas.
**Do this instead:** Todas las llamadas a APIs externas pasan por el backend Express como proxy.

### Anti-Pattern 2: Servidor monolitico

**What people do:** Toda la logica del servidor en un unico `server.js` de 300+ lineas.
**Why it's wrong:** Dificil de mantener, testear, y extender.
**Do this instead:** Un archivo por ruta en `server/routes/`. El `index.js` solo configura Express y monta las rutas.

### Anti-Pattern 3: Guardar archivos en disco del servidor

**What people do:** Usar multer con diskStorage para guardar archivos antes de reenviarlos.
**Why it's wrong:** Crea archivos huerfanos si el proceso falla. Necesita limpieza manual. Innecesario para un proxy.
**Do this instead:** Usar `multer.memoryStorage()` y reenviar el buffer directamente a ClickUp. Para archivos muy grandes, considerar streaming.

### Anti-Pattern 4: Ignorar fallos parciales en el flujo ticket + adjunto

**What people do:** Asumir que si el ticket se crea, el adjunto tambien funcionara.
**Why it's wrong:** Son dos llamadas independientes. La segunda puede fallar (limite de storage, timeout, etc).
**Do this instead:** Si el adjunto falla, mostrar al usuario el enlace del ticket creado + opcion de reintentar la subida del adjunto.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-50 usuarios (prototipo) | Arquitectura actual. Express en localhost. Sin problemas. |
| 50-500 usuarios | Desplegar en servidor. Anadir rate limiting a los endpoints proxy. Considerar queue para peticiones a Claude API. |
| 500+ usuarios | Separar frontend (CDN/static hosting) de backend (API server). Autenticacion. Monitoring. |

### Scaling Priorities

1. **First bottleneck:** Claude API rate limits. Mitigar con cola de peticiones y feedback visual al usuario.
2. **Second bottleneck:** Tamano de archivos de video en memoria (multer memoryStorage). Para videos largos, migrar a streaming.

## Sources

- [ClickUp Create Task API](https://developer.clickup.com/reference/createtask)
- [ClickUp Create Task Attachment API](https://developer.clickup.com/reference/createtaskattachment)
- [MDN MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [MDN MediaStream Recording API](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_Recording_API/Using_the_MediaStream_Recording_API)
- [Express multer middleware](https://expressjs.com/en/resources/middleware/multer.html)
- [Chrome Android SpeechRecognition + MediaRecorder conflict](https://support.google.com/chrome/thread/364791156)
- [InstantScribe - Web recorder with transcription](https://github.com/cs-util-com/InstantScribe)

---
*Architecture research for: BugShot internal bug reporting webapp*
*Researched: 2026-03-07*
