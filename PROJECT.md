# RecUp — Project Documentation

## 1. Vision general

**RecUp** es una webapp interna para reportar incidencias (bugs) mediante audio o texto. Procesa las transcripciones con IA (Claude) y crea tickets en ClickUp automáticamente.

### Stack técnico

| Capa | Tecnología |
|---|---|
| Runtime | Bun |
| Backend | Express 4 (ESM) |
| Base de datos | Turso (@libsql/client) — SQLite remoto |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| IA | Anthropic API (Claude Haiku 4.5) |
| Integraciones | ClickUp API v2 |
| Frontend | Vanilla JS (ESM modules), HTML, CSS |
| Extensión | Chrome Extension Manifest V3 |
| Uploads | Multer (memory storage) |

### Arquitectura a alto nivel

```
[Chrome Extension] --query params--> [Frontend SPA] --fetch--> [Express API] ---> [Turso (SQLite)]
                                                                    |
                                                          +---------+---------+
                                                          |                   |
                                                   [Anthropic API]    [ClickUp API]
```

---

## 2. Estructura del proyecto

```
RecUp/
├── server/
│   ├── index.js              # Entry point, Express setup, static serving
│   ├── db.js                 # Turso/libSQL client, schemas, error logger
│   ├── middleware/
│   │   └── auth.js           # JWT sign/verify, authMiddleware
│   └── routes/
│       ├── auth.js           # Register/login con rate limiting
│       ├── incidents.js      # CRUD de incidencias (auth required)
│       ├── summarize.js      # Proxy a Claude API
│       ├── ticket.js         # Creacion de tickets en ClickUp
│       └── attachment.js     # Upload de archivos a ClickUp tasks
├── src/
│   ├── index.html
│   ├── css/
│   └── js/
│       ├── app.js            # Orquestador principal, auth UI, grabacion
│       ├── auth.js            # getSession, authHeaders (localStorage)
│       ├── incident-api.js    # persistIncident, saveIncidentResult
│       ├── incident-renderer.js # Render DOM, summarize flow, CRUD visual
│       ├── ticket-modal.js    # Modal de creacion de ticket ClickUp
│       ├── summarizer.js      # Fetch a /api/summarize
│       ├── transcriber.js     # Web Speech API (SpeechRecognition)
│       ├── recorder.js        # MediaRecorder wrapper
│       ├── attachments.js     # AttachmentManager (files/camera)
│       ├── confirm-modal.js   # Modal de confirmacion generico
│       ├── toast.js           # Notificaciones toast
│       ├── strings.js         # Constantes UI y mensajes de error
│       ├── icons.js           # SVG icons como strings
│       ├── time.js            # timeAgo, parseUTC, formatDuration
│       ├── utils.js           # capitalize, ensurePeriod
│       └── mocks.js           # Datos mock para desarrollo
├── chrome-extension/
│   ├── manifest.json          # Manifest V3
│   ├── background.js          # Service worker (context menu)
│   ├── popup.html
│   ├── popup.js               # Login, grabacion, envio desde popup
│   ├── popup.css
│   └── icons/
├── dbLogs/                    # Error logs
├── scripts/
│   └── seed-users.js
└── package.json
```

---

## 3. Base de datos

**Motor:** SQLite via Turso (`@libsql/client`). DB remota en Turso cloud.

### Tabla `users`

| Columna | Tipo | Restricciones |
|---|---|---|
| id | INTEGER | PK AUTOINCREMENT |
| name | TEXT | NOT NULL |
| email | TEXT | UNIQUE NOT NULL |
| password | TEXT | NOT NULL (bcrypt hash) |
| clickup_user_id | TEXT | nullable |
| created_at | TEXT | DEFAULT datetime('now') |

### Tabla `incidents`

| Columna | Tipo | Restricciones |
|---|---|---|
| id | INTEGER | PK AUTOINCREMENT |
| user_id | INTEGER | NOT NULL, FK → users(id) |
| transcript | TEXT | nullable |
| title | TEXT | nullable |
| bullets | TEXT | nullable (JSON string) |
| status | TEXT | DEFAULT 'procesando', CHECK IN ('procesando','completado','error') |
| source_type | TEXT | CHECK IN ('audio','text','extension') |
| duration_ms | INTEGER | DEFAULT 0 |
| clickup_task_id | TEXT | nullable |
| clickup_task_url | TEXT | nullable |
| created_at | TEXT | DEFAULT datetime('now') |

### Indices

- `idx_incidents_user_id` ON incidents(user_id)

### Estados posibles (`status`)

| Estado | Significado |
|---|---|
| `procesando` | Pendiente de summarize por Claude |
| `completado` | Procesado (con o sin ticket ClickUp) |
| `error` | Fallo en el procesamiento |

---

## 4. Autenticacion y sesiones

### Registro y login

- **Registro:** `POST /api/auth/register` — name, email, password
  - Password hasheado con `bcryptjs` (salt rounds: 10)
  - Dominio de email restringible via `ALLOWED_EMAIL_DOMAIN`
- **Login:** `POST /api/auth/login` — email, password
  - Verificacion con `bcrypt.compare()`
- Ambos devuelven JWT firmado

### JWT

- Algoritmo: HS256 (default de jsonwebtoken)
- Expiracion: **7 dias**
- Payload: `{ sub: userId, name, email }`
- Secret: `JWT_SECRET` env var (fallback: `'dev-secret-change-me'`)

### Persistencia de sesion

- **Web:** `localStorage.setItem('recup_session', JSON.stringify({ token, user }))`
- **Extension:** `chrome.storage.local` — keys: `recup_token`, `recup_email`, `recup_name`

### Proteccion de rutas

- `authMiddleware` extrae Bearer token del header `Authorization`
- Decodifica JWT y setea `req.user = { id, name, email }`
- Rutas protegidas: `/api/incidents` (GET/POST/PATCH/DELETE), `/api/attachment`
- **Ownership validation:** PATCH y DELETE de incidents verifican `incident.user_id === req.user.id` → 403 si no coincide

### Rate limiting

- Solo en rutas de auth (register + login)
- In-memory Map por IP
- **10 intentos por minuto** por IP
- Ventana: 60 segundos deslizante

### Limitaciones

- Sin token refresh
- Sin OAuth / SSO
- Sin server-side logout (el cliente borra localStorage)
- Sin CSRF protection (API es stateless con Bearer tokens)

---

## 5. API Endpoints

### Auth

| Metodo | Path | Auth | Body | Respuesta OK | Errores |
|---|---|---|---|---|---|
| POST | `/api/auth/register` | No | `{ name, email, password }` | 201 `{ success, data: { token, user: { name, email } } }` | 400 INVALID_NAME, INVALID_EMAIL, WEAK_PASSWORD, EMAIL_DOMAIN; 409 EMAIL_TAKEN; 429 RATE_LIMITED |
| POST | `/api/auth/login` | No | `{ email, password }` | 200 `{ success, data: { token, user: { name, email } } }` | 400 REQUIRED_FIELDS; 401 INVALID_CREDENTIALS; 429 RATE_LIMITED |

### Incidents

| Metodo | Path | Auth | Body/Query | Respuesta OK | Errores |
|---|---|---|---|---|---|
| GET | `/api/incidents` | Bearer | Query: `limit` (default 20), `offset` (default 0) | 200 `{ success, data: { incidents: [...], total } }` | 401 UNAUTHORIZED |
| POST | `/api/incidents` | Bearer | `{ transcript, title?, bullets?, status?, source_type?, duration_ms?, clickup_task_id?, clickup_task_url? }` | 201 `{ success, data: { incident } }` | 400 TRANSCRIPT_REQUIRED; 401 |
| PATCH | `/api/incidents/:id` | Bearer | Campos permitidos: `clickup_task_id, clickup_task_url, status, title, bullets, transcript` | 200 `{ success, data: { incident } }` | 400 INVALID_ID, NO_VALID_FIELDS; 403 UNAUTHORIZED; 404 NOT_FOUND |
| DELETE | `/api/incidents/:id` | Bearer | — | 200 `{ success: true }` | 400 INVALID_ID; 403 UNAUTHORIZED; 404 NOT_FOUND |

### Summarize

| Metodo | Path | Auth | Body | Respuesta OK | Errores |
|---|---|---|---|---|---|
| POST | `/api/summarize` | No | `{ transcript }` | 200 `{ is_bug, title?, transcript, bullets[] }` | 400 TRANSCRIPT_REQUIRED; 500 API_KEY_MISSING; 502 EMPTY_RESPONSE, INVALID_JSON; 504 TIMEOUT (30s) |

### Ticket (ClickUp)

| Metodo | Path | Auth | Body | Respuesta OK | Errores |
|---|---|---|---|---|---|
| POST | `/api/ticket` | No | `{ name, markdown_description?, reporterEmail?, assetId?, platform?, product?, appVersion? }` | 200 `{ id, url }` | 400 NAME_REQUIRED; 403 NO_MEMBER; 500 CLICKUP_NOT_CONFIGURED, INTERNAL_ERROR |

### Attachment

| Metodo | Path | Auth | Body | Respuesta OK | Errores |
|---|---|---|---|---|---|
| POST | `/api/attachment` | Bearer | multipart: `taskId` + `attachment` (max 5 files, 100MB each) | 200 `{ attachments: [...] }` | 400 TASK_ID_REQUIRED, FILE_REQUIRED; 500 API_KEY_MISSING, UPLOAD_ERROR |

---

## 6. Extension Chrome

### Manifest V3

- **Permisos:** `storage`, `tabs`, `contextMenus`
- **Host permissions:** `http://localhost:3000/*`
- **Service worker:** `background.js`
- **Popup:** `popup.html` + `popup.js`

### Service worker (`background.js`)

- Crea context menu item "Enviar a RecUp" para texto seleccionado
- Al hacer clic: abre/reutiliza pestaña RecUp con query params (`contextText`, `token`, `email`, `name`)
- Credenciales leidas de `chrome.storage.local`

### Popup (`popup.js`)

- Login propio contra `POST /api/auth/login`
- Grabacion de audio con `getUserMedia` + Web Speech API (via `window.startTranscription`)
- Envio directo: crea incident via `POST /api/incidents` y redirige a la web con `?highlight={id}`
- Registro: redirige a la web con `#register`
- Validacion de token al abrir: `GET /api/incidents?limit=1` → si 401, limpia storage y muestra login

---

## 7. Comunicacion extension ↔ web

### Query params (extension → web)

| Param | Uso | Consumido en |
|---|---|---|
| `contextText` | Texto seleccionado via context menu | `handleExternalText()` — crea incident automaticamente |
| `token` | JWT del usuario logueado en extension | `adoptExtensionSession()` — adopta sesion si no hay una |
| `email` | Email del usuario | `adoptExtensionSession()` |
| `name` | Nombre del usuario | `adoptExtensionSession()` |
| `highlight` | ID de incident recien creado | `handleExtensionMode()` — scroll + highlight + auto-open ticket modal |

Todos los params se limpian de la URL con `history.replaceState` tras consumirse.

### Chrome Storage API

Keys en `chrome.storage.local`:
- `recup_token` — JWT
- `recup_email` — email del usuario
- `recup_name` — nombre del usuario

---

## 8. Flujos principales

### Audio → summarize → ticket

```
Usuario pulsa grabar
  → getUserMedia + SpeechRecognition (es-ES, continuous)
  → Pulsa parar
  → stopTranscription() devuelve transcript
  → createIncident(transcript, audioBlob, duration)
    → Render card con badge "procesando" + spinner
    → POST /api/incidents (persiste con status=procesando)
    → POST /api/summarize { transcript }
      → Claude analiza: is_bug? → title + bullets
    → PATCH /api/incidents/:id { title, bullets, status=completado }
    → Auto-open ticket modal
      → Usuario rellena campos (app, plataforma, version, assetId)
      → POST /api/ticket → crea task en ClickUp
      → POST /api/attachment (si hay adjuntos)
      → PATCH /api/incidents/:id { clickup_task_id, clickup_task_url, status=completado }
```

### Texto → summarize → ticket

```
Usuario cambia a modo texto (toggle)
  → Escribe en textarea
  → Submit
  → createIncident(text, null, 0)
  → Mismo flujo que audio desde "Render card..."
```

### Context menu → web → ticket

```
Usuario selecciona texto en cualquier pagina
  → Click derecho → "Enviar a RecUp"
  → background.js lee chrome.storage.local (token, email, name)
  → Abre/reutiliza tab: localhost:3000/?contextText=...&token=...&email=...&name=...
  → adoptExtensionSession() adopta credenciales si no hay sesion
  → handleExternalText() consume contextText
  → createIncident(contextText, null, 0)
  → Mismo flujo summarize → ticket
```

### Popup → incident → web

```
Usuario abre popup
  → Login o sesion existente (chrome.storage.local)
  → Graba audio o escribe texto
  → POST /api/incidents (crea incident en BD)
  → Redirige a web: ?highlight={incidentId}&token=...&email=...
  → Web: adoptExtensionSession() + loadIncidents() + handleExtensionMode()
  → Scroll a card + highlight + auto-open ticket modal si tiene summary
```

### Carga de incidencias (paginacion)

```
DOMContentLoaded → loadIncidents()
  → GET /api/incidents?limit=25&offset=0
  → Render cada incident con renderIncidentFromDB()
  → Si offset < total → boton "Cargar mas"
    → loadIncidents(append=true) con offset incrementado
  → resumePendingIncidents(): re-procesa incidents con status=procesando
```

---

## 9. Integracion ClickUp

### Endpoints usados

| Accion | Endpoint ClickUp |
|---|---|
| Crear task | `POST /api/v2/list/{listId}/task` |
| Set reporter | `POST /api/v2/task/{taskId}/field/{fieldId}` |
| Upload attachment | `POST /api/v2/task/{taskId}/attachment?custom_field_id={fieldId}` |
| Listar miembros | `GET /api/v2/team` |

### Custom fields (UUIDs)

| Campo | UUID |
|---|---|
| Reporter | `c9fb2e87-b7a9-4646-9292-d74225f4e2d3` |
| Asset ID | `3aedd038-ce17-4325-9dfb-10ba2a85d89d` |
| Dispositivo | `b07abf0c-7bae-405d-a107-31af17c98867` |
| Version App | `660974a4-2eef-4dd3-bbbd-0c50eaea0216` |
| Captura | `567894b1-a0bf-4ae5-926d-5e0a4d55a982` |

### Cache de miembros

- In-memory cache de workspace members
- TTL: **10 minutos**
- Se usa para resolver `reporterEmail` → `userId` de ClickUp
- Si el email no matchea ningun miembro → responde 403 `NO_MEMBER`

### Prioridad

- Todos los tickets se crean con prioridad `3` (Normal)

---

## 10. Integracion Claude

### Modelo

- `claude-haiku-4-5-20251001`

### Configuracion

| Parametro | Valor |
|---|---|
| max_tokens | 1024 |
| temperature | 0.3 |
| timeout | 30 segundos (AbortController) |

### Prompt del sistema

Analiza transcripciones de voz/texto para detectar bugs. Dos posibles respuestas:

**Si es bug** (`is_bug: true`):
```json
{ "is_bug": true, "title": "titulo max 10 palabras", "transcript": "limpia", "bullets": ["hecho 1", "hecho 2"] }
```

**Si no es bug** (`is_bug: false`):
```json
{ "is_bug": false, "transcript": "transcripcion limpia" }
```

Directrices clave del prompt:
- Ser MUY permisivo al detectar bugs
- Bullets solo factuales (sin hipotesis ni soluciones)
- Solo JSON, sin markdown code blocks

---

## 11. Frontend

### Modulos JS

| Modulo | Responsabilidad |
|---|---|
| `app.js` | Orquestador: auth UI, toggle mic/texto, grabacion, carga de incidents, extension mode |
| `auth.js` | `getSession()` de localStorage, `authHeaders()` helper |
| `incident-renderer.js` | Crear/render cards DOM, flujo summarize, tickets, delete |
| `incident-api.js` | `persistIncident()` (POST), `saveIncidentResult()` (PATCH o POST) |
| `ticket-modal.js` | Modal completo de creacion ClickUp: campos, adjuntos, camara, validacion |
| `summarizer.js` | `summarize(transcript)` — fetch a `/api/summarize` |
| `transcriber.js` | Web Speech API wrapper: `startTranscription(onError)`, `stopTranscription()` → Promise<string> |
| `recorder.js` | MediaRecorder: `requestMicAccess()`, `startRecording()`, `stopRecording()` → Blob |
| `attachments.js` | `AttachmentManager` — gestion de archivos y previews |
| `strings.js` | Constantes de UI y mapa de errores API |

### Patrones de datos

- **Fetch raw:** Todas las llamadas API usan `fetch()` nativo, sin wrapper global
- **DOM dataset:** Los datos de cada incident se almacenan en `data-*` attributes del DOM element (`incidentId`, `summaryTitle`, `summaryTranscript`, `summaryBullets`, `createdAt`, `sourceType`, `durationMs`)
- **localStorage:** `recup_session` (token + user), `recup_input_mode` (mic/keyboard)
- **No hay framework:** Vanilla JS con manipulacion directa del DOM

---

## 12. Variables de entorno

| Variable | Obligatoria | Descripcion |
|---|---|---|
| `TURSO_DATABASE_URL` | Si | URL de la base de datos Turso (ej: `libsql://db.turso.io`) |
| `TURSO_AUTH_TOKEN` | Si (prod) | Token de autenticacion Turso |
| `ANTHROPIC_API_KEY` | Si | API key de Anthropic para Claude |
| `CLICKUP_API_KEY` | Si | API key personal de ClickUp |
| `CLICKUP_LIST_ID` | Si | ID de la lista ClickUp donde crear tasks |
| `JWT_SECRET` | Si (prod) | Secret para firmar JWT. Fallback: `'dev-secret-change-me'` |
| `PORT` | No | Puerto del servidor. Default: `3000` |
| `ALLOWED_EMAIL_DOMAIN` | No | Restringe registro a un dominio de email (ej: `empresa.com`) |

---

## 13. Seguridad

| Mecanismo | Implementacion |
|---|---|
| **Password hashing** | `bcryptjs` hash / compare (salt rounds: 10) |
| **JWT** | HS256, expira en 7d, secret configurable |
| **Rate limiting** | 10 req/min/IP en register + login (in-memory) |
| **Ownership** | PATCH/DELETE incidents validan `user_id === req.user.id` |
| **Upload limits** | 100MB por archivo, max 5 archivos por request |
| **Input validation** | Email regex, password min 6 chars, name 1-100 chars, domain restriction opcional |
| **XSS** | `.textContent` para todo el rendering (no `innerHTML` con datos de usuario) |
| **CORS** | No configurado explicitamente (mismo origin, localhost) |
| **Sin HTTPS** | Solo localhost, no hay TLS |
