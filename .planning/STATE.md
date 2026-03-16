---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: MVP
status: unknown
last_updated: "2026-03-16T17:52:19.591Z"
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 12
  completed_plans: 5
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-08)

**Core value:** El empleado graba, describe el problema hablando, y con un click tiene un ticket estructurado en ClickUp con toda la evidencia.
**Current focus:** v1.1 — Extensión Chrome para Bugshot

## Current Position

Phase: 03-refactorizar-backend
Current Plan: 01 (de 3)
Last activity: 2026-03-16 - Completed 03-01: Config foundation (constants.js, env.js, system prompt)

Progress: [████░░░░░░] 42%

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Web Speech API requiere Chromium (Chrome/Edge) — feature detection obligatorio
- Screen capture diferido — video mode = solo camara
- Transcripcion corre durante grabacion pero texto completo se muestra al parar
- ClickUp: crear tarea + adjuntar archivo = 2 llamadas API separadas
- Tailwind v4 via CDN browser build (sin build step)
- bun como runtime y package manager
- Auth local client-side (password '1234') en extensión — no hay /api/login real en v1
- Token guardado como string 'local' en chrome.storage.local (placeholder para v2 con JWT)
- [Phase 02]: UUID v4 en lugar de JWT para sesiones — mas simple para herramienta interna, almacenado en tabla sessions DB
- [Phase 02]: bun:sqlite nativo (zero deps) + Bun.password.hash bcrypt nativo — sin dependencias externas para auth y DB
- [Phase 02]: PATCH en lugar de PUT para cards — actualizaciones parciales para flujo webapp
- Micrófono no declarado en manifest (getUserMedia en runtime, plan 03)
- createCard(null, null, 0) para modo extensión — badge-text distingue cards sin audio
- extension@bugshot como sesión temporal cuando llega bugshot_token sin sesión local previa
- Clase .btn-send separada de .btn-primary en popup Idle — evita herencia de width:100% del login
- bugshot_token leído desde chrome.storage.local al enviar, con fallback 'local'
- [Phase 01-extensi-n-chrome-para-bugshot]: transcriber.js usa window.* exports en lugar de ES modules (scripts clásicos en extensión Chrome)
- [Phase 01-extensi-n-chrome-para-bugshot]: No envío automático al parar grabación — transcript va al textarea para revisión del usuario
- [Phase 01-extensi-n-chrome-para-bugshot]: sips elegido sobre ImageMagick/sharp para generar iconos PNG — disponible en macOS sin instalación
- [Phase 01-extensi-n-chrome-para-bugshot]: Datos popup->webapp via URL query params — chrome.storage.session no accesible desde páginas web normales
- [Phase 01-extensi-n-chrome-para-bugshot]: Permiso microphone declarado en manifest.json MV3 para getUserMedia en popup
- [Phase 02-base-de-datos-simple-para-gesti-n-de-usuarios-y-asociaci-n-de-cards]: UUID v4 para sesiones (no JWT) — almacenado en DB, mas simple para herramienta interna
- [Phase 02-base-de-datos-simple-para-gesti-n-de-usuarios-y-asociaci-n-de-cards]: bun:sqlite nativo + Bun.password bcrypt nativo — zero dependencias externas para auth y DB
- [Phase 02-base-de-datos-simple-para-gesti-n-de-usuarios-y-asociaci-n-de-cards]: PATCH en lugar de PUT para cards — actualizaciones parciales para flujo webapp
- [Phase 02-base-de-datos-simple-para-gesti-n-de-usuarios-y-asociaci-n-de-cards]: Extension Chrome autentica contra API real con fetch POST /api/auth/login; token UUID en chrome.storage.local
- [Phase 02-base-de-datos-simple-para-gesti-n-de-usuarios-y-asociaci-n-de-cards]: onTicketCreated callback en openTicketModal — ticket-modal desacoplado del modelo de cards
- [Phase 02-base-de-datos-simple-para-gesti-n-de-usuarios-y-asociaci-n-de-cards]: renderCardFromDB() separada de createCard() — cards de DB tienen estado final, sin spinner ni summarize
- [Phase 02-base-de-datos-simple-para-gesti-n-de-usuarios-y-asociaci-n-de-cards]: Degradacion graceful en persistCard() — card visible en DOM aunque POST /api/cards falle
- [Phase 02-base-de-datos-simple-para-gesti-n-de-usuarios-y-asociaci-n-de-cards]: handleExtensionMode sin fallback 'local' — sin token en params muestra login (no sesion ficticia que rompe API)
- [Phase 03-refactorizar-backend]: JWT_SECRET required (no insecure fallback) en env.js — server exits con FATAL si falta
- [Phase 03-refactorizar-backend]: Config-first pattern: dotenv/config movido a env.js, todo acceso a env vars via config object

### Pending Todos

- Validar transcript antes de llamar a Claude para evitar consumo innecesario de tokens (api)
- Add keyboard text input button to webapp (ui)
- Prepare Chrome extension for unlisted Chrome Web Store publishing (general)
- Refactorizar frontend y backend — poner orden y reutilizar (code-quality)
- Evaluar domain knowledge de Alfred en prompt de resumen (api)
- Implementar testing backend y frontend (testing)


### Roadmap Evolution

- Phase 1 added: Extensión Chrome para Bugshot (v1.1)
- Phase 2 added: Base de datos simple para gestión de usuarios y asociación de cards
- Phase 3 added: Refactorizar backend: extraer constantes, middleware de errores, IncidentService, ClickUpService, rate limiting middleware, validar env vars, extraer system prompt

### Blockers/Concerns

None.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 5 | Rediseñar login: layout dos columnas con imagen bug.png alineada, responsivo en móvil | 2026-03-13 | e8b8f22 | [5-redise-ar-login-layout-dos-columnas-con-](./quick/5-redise-ar-login-layout-dos-columnas-con-/) |
| 6 | Autoscroll al top del feed tras crear incident en webapp | 2026-03-14 | 45f84dc | [6-implementar-autoscroll-en-la-webapp](./quick/6-implementar-autoscroll-en-la-webapp/) |
| 8 | Migrar autenticación de sesiones SQLite a JWT stateless | 2026-03-15 | bf5d9c0 | [8-migrar-autenticaci-n-de-sesiones-sqlite-](./quick/8-migrar-autenticaci-n-de-sesiones-sqlite-/) |
| 9 | Gestionar errores de grabación sin control: fatal error detection, forceCleanup, timeout 5min | 2026-03-16 | 7b97323 | [9-gestionar-errores-de-grabaci-n-sin-contr](./quick/9-gestionar-errores-de-grabaci-n-sin-contr/) |
| 10 | Auto-abrir formulario de ticket cuando hay resumen de bug | 2026-03-16 | c4410cc | [10-auto-abrir-formulario-de-ticket-cuando-h](./quick/10-auto-abrir-formulario-de-ticket-cuando-h/) |
| 11 | Form labels, badges y auto-select plataforma Web | 2026-03-16 | 9c7c234 | [11-form-labels-badges-y-auto-select-platafo](./quick/11-form-labels-badges-y-auto-select-platafo/) |
| 12 | Enviar a RecUp desde Chrome context menu + clipboard | 2026-03-16 | 04a8c06 | [12-enviar-a-recup-desde-chrome-context-menu](./quick/12-enviar-a-recup-desde-chrome-context-menu/) |
