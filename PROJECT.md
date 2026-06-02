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
| IA | Anthropic API (Claude Haiku 4.5) o OpenAI API (GPT-4o mini) — configurable por usuario |
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
                                          +-----------+-----------+    [ClickUp API]
                                          |                       |
                                   [Anthropic API]          [OpenAI API]
```

---

## 2. Estructura del proyecto

```
RecUp/
├── server/
│   ├── index.js              # Entry point: arranca el servidor en config.port
│   ├── app.js                # Express setup, montaje de routers, error handler
│   ├── instrument.js         # Sentry SDK init (cargado con --import/--preload)
│   ├── db.js                 # Turso/libSQL client, schemas, migraciones, getUserSettings
│   ├── config/
│   │   ├── env.js            # Validacion de env vars (required/optional)
│   │   ├── constants.js      # Constantes (ClickUp, Claude, OpenAI, JWT, rate limit, multer)
│   │   └── prompts/
│   │       └── summarize-system.txt  # System prompt de la IA
│   ├── middleware/
│   │   ├── auth.js           # JWT sign/verify, authMiddleware
│   │   ├── rateLimiter.js    # Rate limiter in-memory (factory)
│   │   └── errorHandler.js   # Error handler central
│   ├── routes/
│   │   ├── auth.js           # Register/login/me con rate limiting
│   │   ├── incidents.js      # CRUD de incidencias (auth required)
│   │   ├── settings.js       # GET/PUT /api/settings (config por usuario)
│   │   ├── summarize.js      # Proxy a Claude o OpenAI segun ai_provider
│   │   ├── ticket.js         # Creacion de tickets en ClickUp
│   │   └── attachment.js     # Upload de archivos a ClickUp tasks
│   └── services/
│       ├── ClickUpService.js # Wrapper API ClickUp (members, tasks, custom fields, uploads)
│       ├── IncidentService.js# CRUD incidents + ownership assertion
│       └── crypto.js         # AES-256-GCM encrypt/decrypt/hint para API keys
├── src/
│   ├── index.html
│   ├── css/
│   └── js/
│       ├── app.js            # Orquestador principal, auth UI, grabacion
│       ├── auth.js           # getSession, authHeaders (localStorage)
│       ├── incident-api.js   # persistIncident, saveIncidentResult
│       ├── incident-renderer.js # Render DOM, summarize flow, CRUD visual
│       ├── ticket-modal.js   # Modal de creacion de ticket ClickUp
│       ├── settings-modal.js # Modal de configuracion (API keys, ai_provider)
│       ├── summarizer.js     # Fetch a /api/summarize
│       ├── transcriber.js    # Web Speech API (SpeechRecognition)
│       ├── recorder.js       # MediaRecorder wrapper
│       ├── attachments.js    # AttachmentManager (files/camera)
│       ├── confirm-modal.js  # Modal de confirmacion generico
│       ├── toast.js          # Notificaciones toast
│       ├── strings.js        # Constantes UI y mensajes de error
│       ├── icons.js          # SVG icons como strings
│       ├── time.js           # timeAgo, parseUTC, formatDuration
│       ├── utils.js          # capitalize, ensurePeriod
│       └── mocks.js          # Datos mock para desarrollo
├── chrome-extension/
│   ├── manifest.json         # Manifest V3
│   ├── background.js         # Service worker (context menu, sesion)
│   ├── content.js            # Content script: escucha recup:logout y limpia storage
│   ├── config.js             # Config compartida (URL base)
│   ├── transcriber.js        # Web Speech API para el popup
│   ├── popup.html
│   ├── popup.js              # Login, grabacion, envio desde popup
│   ├── popup.css
│   └── icons/
├── tests/                    # Suite bun:test (auth, crypto, incidents, settings, proxy)
│   ├── preload.js            # Configura TURSO_DATABASE_URL=:memory: + secrets
│   ├── setup.js
│   └── *.test.js
├── dbLogs/                   # Error logs
├── scripts/
│   ├── seed-users.js
│   ├── backup-turso.sh
│   └── BACKUP.md
├── biome.json                # Configuracion Biome (lint + format)
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
| avatar_url | TEXT | nullable |
| clickup_api_key | TEXT | nullable — API key personal de ClickUp |
| clickup_list_id | TEXT | nullable — ID de la lista de ClickUp donde se crean los tickets |
| anthropic_api_key | TEXT | nullable — API key personal de Anthropic |
| openai_api_key | TEXT | nullable — API key personal de OpenAI |
| ai_provider | TEXT | DEFAULT 'anthropic' — proveedor activo: `'anthropic'` o `'openai'` |
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
  - Password hasheado con `bcryptjs` (salt rounds: **12**)
  - Minimo **8 caracteres** de password
  - Dominio de email restringible via `ALLOWED_EMAIL_DOMAIN`
  - Si `CLICKUP_API_KEY` esta configurada a nivel servidor, valida que el email este en el workspace ClickUp (fail-open si la llamada falla)
- **Login:** `POST /api/auth/login` — email, password
  - Verificacion con `bcrypt.compare()`
  - **Mitigacion de enumeracion:** dummy `bcrypt.compare` si el usuario no existe para igualar tiempos de respuesta
  - Refresca `avatar_url` desde ClickUp si el usuario tiene `clickup_api_key` guardada
- **`GET /api/auth/me`** — recupera datos del usuario actual (requiere Bearer)
- Register y login devuelven JWT firmado

### JWT

- Algoritmo: HS256 (default de jsonwebtoken)
- Expiracion: **30 dias** (`JWT_EXPIRES_IN`)
- Payload: `{ sub: userId, name, email }`
- Secret: `JWT_SECRET` env var (obligatoria, sin fallback en runtime)

### Persistencia de sesion

- **Web:** `localStorage.setItem('recup_session', JSON.stringify({ token, user }))`
- **Extension:** `chrome.storage.local` — keys: `recup_token`, `recup_email`, `recup_name`

### Proteccion de rutas

- `authMiddleware` extrae Bearer token del header `Authorization`
- Decodifica JWT y setea `req.user = { id, name, email }`
- Rutas protegidas: `/api/auth/me`, `/api/incidents` (GET/POST/PATCH/DELETE), `/api/summarize`, `/api/ticket`, `/api/attachment`, `/api/settings` (GET/PUT)
- **Ownership validation:** GET por id, PATCH y DELETE de incidents verifican `incident.user_id === req.user.id` → 403 si no coincide

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
| POST | `/api/auth/register` | No | `{ name, email, password }` | 201 `{ success, data: { token, user: { name, email } } }` | 400 INVALID_NAME, INVALID_EMAIL, WEAK_PASSWORD (min 8), EMAIL_DOMAIN, EMAIL_NOT_IN_WORKSPACE; 409 EMAIL_TAKEN; 429 RATE_LIMITED |
| POST | `/api/auth/login` | No | `{ email, password }` | 200 `{ success, data: { token, user: { name, email, avatar } } }` | 400 REQUIRED_FIELDS; 401 INVALID_CREDENTIALS; 429 RATE_LIMITED |
| GET | `/api/auth/me` | Bearer | — | 200 `{ success, data: { user: { name, email, avatar } } }` | 401 UNAUTHORIZED; 404 NOT_FOUND |

### Incidents

| Metodo | Path | Auth | Body/Query | Respuesta OK | Errores |
|---|---|---|---|---|---|
| GET | `/api/incidents` | Bearer | Query: `limit` (default 20), `offset` (default 0) | 200 `{ success, data: { incidents: [...], total } }` | 401 UNAUTHORIZED |
| POST | `/api/incidents` | Bearer | `{ transcript, title?, bullets?, status?, source_type?, duration_ms?, clickup_task_id?, clickup_task_url? }` | 201 `{ success, data: { incident } }` | 400 TRANSCRIPT_REQUIRED; 401 |
| GET | `/api/incidents/:id` | Bearer | — | 200 `{ success, data: { incident } }` | 400 INVALID_ID; 403 UNAUTHORIZED; 404 NOT_FOUND |
| PATCH | `/api/incidents/:id` | Bearer | Campos permitidos: `clickup_task_id, clickup_task_url, status, title, bullets, transcript` | 200 `{ success, data: { incident } }` | 400 INVALID_ID, NO_VALID_FIELDS; 403 UNAUTHORIZED; 404 NOT_FOUND |
| DELETE | `/api/incidents/:id` | Bearer | — | 200 `{ success: true }` | 400 INVALID_ID; 403 UNAUTHORIZED; 404 NOT_FOUND |

### Summarize

| Metodo | Path | Auth | Body | Respuesta OK | Errores |
|---|---|---|---|---|---|
| POST | `/api/summarize` | Bearer | `{ transcript }` | 200 `{ is_bug, title?, transcript, bullets[] }` | 400 TRANSCRIPT_REQUIRED, SETTINGS_NOT_CONFIGURED; 4xx AI_API_ERROR (passthrough); 502 EMPTY_RESPONSE, INVALID_JSON; 504 TIMEOUT (30s) |

### Ticket (ClickUp)

| Metodo | Path | Auth | Body | Respuesta OK | Errores |
|---|---|---|---|---|---|
| POST | `/api/ticket` | Bearer | `{ name, markdown_description?, reporterEmail?, assetId?, platform?, product?, appVersion? }` | 200 `{ id, url }` | 400 NAME_REQUIRED, SETTINGS_NOT_CONFIGURED; 403 NO_MEMBER; 500 CLICKUP_API_ERROR |

### Attachment

| Metodo | Path | Auth | Body | Respuesta OK | Errores |
|---|---|---|---|---|---|
| POST | `/api/attachment` | Bearer | multipart: `taskId` + `attachment` (max 5 files, 100MB each) | 200 `{ attachments: [...] }` | 400 TASK_ID_REQUIRED, FILE_REQUIRED, SETTINGS_NOT_CONFIGURED; 5xx CLICKUP_UPLOAD_ERROR |

### Settings (config por usuario)

| Metodo | Path | Auth | Body | Respuesta OK | Errores |
|---|---|---|---|---|---|
| GET | `/api/settings` | Bearer | — | 200 `{ clickup_list_id, ai_provider, clickup_api_key: { configured, hint }, anthropic_api_key: {...}, openai_api_key: {...} }` | 401 |
| PUT | `/api/settings` | Bearer | `{ clickup_api_key?, clickup_list_id?, anthropic_api_key?, openai_api_key?, ai_provider? }` | 200 `{ ok: true }` | 401 |

Las API keys se almacenan cifradas con AES-256-GCM. El GET nunca devuelve la key en claro, solo `configured` + `hint` (ultimos caracteres).

---

## 6. Extension Chrome

### Manifest V3

- **Permisos:** `storage`, `tabs`, `contextMenus`, `scripting`
- **Host permissions:** `https://recup.onrender.com/*`, `http://localhost:3000/*`
- **Service worker:** `background.js`
- **Content script:** `content.js` — inyectado en las URLs de la app; escucha `recup:logout` postMessage y lo retransmite al background para limpiar `chrome.storage.local`
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

## 10. Integracion IA

El usuario elige el proveedor desde Configuración. El servidor usa `ai_provider` de la BD para enrutar la llamada.

### Proveedores disponibles

| Proveedor | Modelo | API endpoint |
|---|---|---|
| `anthropic` (default) | `claude-haiku-4-5-20251001` | `https://api.anthropic.com/v1/messages` |
| `openai` | `gpt-4o-mini` | `https://api.openai.com/v1/chat/completions` |

### Configuracion comun

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
| `settings-modal.js` | Modal de configuracion de usuario: API keys (Anthropic/OpenAI/ClickUp), lista ClickUp, `ai_provider` |
| `confirm-modal.js` | Modal generico de confirmacion |
| `toast.js` | Notificaciones toast (success/error) |
| `icons.js` | Iconos SVG como strings |
| `time.js` | `timeAgo`, `parseUTC`, `formatDuration` |
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
| `TURSO_DATABASE_URL` | Si | URL de la base de datos Turso (`libsql://...`) o `:memory:` para tests |
| `TURSO_AUTH_TOKEN` | Si (prod) | Token de autenticacion Turso. Omitible en local con `:memory:` |
| `JWT_SECRET` | Si | Secret para firmar JWT (validado al arrancar) |
| `CRYPTO_SECRET` | Si | Clave AES-256-GCM para cifrar `users.*_api_key`. Generar con `openssl rand -base64 32`. Perderla deja las keys cifradas irrecuperables |
| `CLICKUP_API_KEY` | No | Key a nivel servidor — solo se usa en registro para validar `EMAIL_NOT_IN_WORKSPACE` (fail-open) |
| `ANTHROPIC_API_KEY` | No | Key fallback opcional (cada usuario configura la suya en `/api/settings`) |
| `CLICKUP_LIST_ID` | No | Lista por defecto si el usuario no configura la suya |
| `ALLOWED_EMAIL_DOMAIN` | No | Restringe registro a un dominio de email (ej: `empresa.com`) |
| `SENTRY_DSN` | No | Si esta seteada, los errores se reportan a Sentry. Omitir en dev para desactivar |
| `SENTRY_ENVIRONMENT` | No | Tag de entorno para Sentry. Default: `development` |
| `PORT` | No | Puerto del servidor. Default: `3000` |

---

## 13. Seguridad

| Mecanismo | Implementacion |
|---|---|
| **Password hashing** | `bcryptjs` hash / compare (salt rounds: **12**) |
| **JWT** | HS256, expira en **30d**, secret obligatorio |
| **Login enumeration** | Dummy `bcrypt.compare` cuando el usuario no existe para igualar tiempos de respuesta |
| **Register enumeration** | Tradeoff aceptado: `409 EMAIL_TAKEN` filtra emails dentro de `ALLOWED_EMAIL_DOMAIN`. Revisar cuando exista infra de email transaccional |
| **API keys cifradas** | `users.clickup_api_key`, `anthropic_api_key`, `openai_api_key` cifradas con **AES-256-GCM** (`CRYPTO_SECRET`). Migracion automatica encripta keys legacy en arranque |
| **Rate limiting** | 10 req/min/IP en register + login (in-memory, factory `createRateLimiter`) |
| **Ownership** | GET/PATCH/DELETE incidents validan `user_id === req.user.id` |
| **Upload limits** | 100MB por archivo, max 5 archivos por request (multer memory storage) |
| **Input validation** | Email regex, password min **8 chars**, name 1-100 chars, domain restriction opcional |
| **XSS** | `.textContent` para todo el rendering (no `innerHTML` con datos de usuario) |
| **Trust proxy** | `app.set('trust proxy', 1)` para `req.ip` correcto detras de reverse proxy |
| **Sentry** | Captura errores via `setupExpressErrorHandler` (antes del custom handler) si `SENTRY_DSN` esta seteada |
| **CORS** | No configurado explicitamente (mismo origin) |
