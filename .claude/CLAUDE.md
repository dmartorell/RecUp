
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev (hot-reload)
bun --watch server/index.js

# Start
bun start

# Tests (bun:test, SQLite in-memory via preload)
bun test
bun test tests/auth.test.js        # single file
bun test --test-name-pattern "POST /api/auth"  # filter by name

# Seed users
bun scripts/seed-users.js
```

## Architecture

RecUp is a voice/text bug-reporting webapp. Users record audio or type text → the server transcribes and sends to AI (Claude or GPT) → a structured bug report is created → optionally a ClickUp ticket is created.

```
[Chrome Extension] --query params--> [Frontend SPA] --fetch--> [Express API] ---> [Turso (libSQL/SQLite)]
                                                                    |
                                                     +--------------+--------------+
                                                     |                             |
                                              [Anthropic API]              [ClickUp API v2]
                                              [OpenAI API]
```

### Backend (`server/`)

- **`index.js`** — entry point, static file serving of `src/`
- **`instrument.js`** — Sentry SDK init, loaded via `--import` / `--preload` before any other module
- **`app.js`** — Express setup, route mounting, error handler (Sentry error handler before custom one)
- **`db.js`** — Turso client, schema init (`users`, `incidents` tables), error logger to `dbLogs/`
- **`config/env.js`** — env var validation
- **`config/prompts/summarize-system.txt`** — AI system prompt for bug detection
- **`middleware/auth.js`** — JWT sign/verify, `authMiddleware` (sets `req.user`)
- **`middleware/rateLimiter.js`** — in-memory rate limiter (10 req/min/IP) for auth routes
- **`routes/summarize.js`** — proxies to Anthropic or OpenAI based on user's `ai_provider` setting
- **`routes/ticket.js`** — creates ClickUp tasks; resolves reporter email → ClickUp userId (10-min cache)
- **`routes/settings.js`** — manages per-user AI provider, API keys, ClickUp list config
- **`services/ClickUpService.js`** — ClickUp API wrapper (create task, set custom fields, upload attachment)
- **`services/IncidentService.js`** — CRUD logic for incidents table

### Frontend (`src/js/`)

Vanilla JS ESM modules, no framework. Static files served by Express.

- **`app.js`** — main orchestrator: auth UI, mic/text toggle, recording flow, incident loading, extension query-param handling
- **`incident-renderer.js`** — DOM card creation, summarize flow trigger, ticket modal launch, delete
- **`incident-api.js`** — `persistIncident()` (POST), `saveIncidentResult()` (PATCH)
- **`ticket-modal.js`** — full ClickUp ticket creation modal (fields, attachments, camera)
- **`transcriber.js`** — Web Speech API wrapper (es-ES, continuous)
- **`recorder.js`** — MediaRecorder wrapper
- **`strings.js`** — all UI strings and API error code → human message mapping

Incident data flows through `data-*` DOM attributes (`incidentId`, `summaryTitle`, `summaryBullets`, `summaryTranscript`, `createdAt`, `sourceType`, `durationMs`).

### Chrome Extension (`chrome-extension/`)

Manifest V3. Service worker creates a context menu "Enviar a RecUp" that opens the webapp with query params (`contextText`, `token`, `email`, `name`). The web app's `app.js` reads these params via `adoptExtensionSession()` and `handleExternalText()`, then clears them from the URL with `history.replaceState`.

### Database

Two tables: `users` (with per-user `clickup_api_key`, `clickup_list_id`, `anthropic_api_key`, `openai_api_key`, `ai_provider`) and `incidents` (`status` ∈ `procesando|completado|error`, `bullets` stored as JSON string). Tests use an in-memory SQLite DB — the preload at `tests/preload.js` sets `TURSO_DATABASE_URL=:memory:`.

### AI Integration

`/api/summarize` reads `ai_provider` from the user's DB row and routes to either Anthropic (`claude-haiku-4-5-20251001`) or OpenAI (`gpt-4o-mini`). Both use `max_tokens: 1024`, `temperature: 0.3`, 30s timeout. The prompt is in `server/config/prompts/summarize-system.txt` and returns strict JSON (no markdown).

### Security notes

- **Login enumeration:** mitigated via a dummy `bcrypt.compare` when the user does not exist, equalizing response times (`server/routes/auth.js`).
- **Register enumeration (accepted tradeoff):** `/api/auth/register` returns `409 EMAIL_TAKEN` when the email is already registered. This leaks which emails exist within `ALLOWED_EMAIL_DOMAIN`. Accepted because the domain is already known and there is no email transactional infra to notify the legitimate owner of a duplicate-registration attempt. Revisit when email infra exists (switch to a generic 201 + notification).

## Environment Variables

| Variable | Required | Notes |
|---|---|---|
| `TURSO_DATABASE_URL` | Yes | `libsql://...` or `:memory:` for tests |
| `TURSO_AUTH_TOKEN` | Yes (prod) | Omit for local dev with `:memory:` |
| `ANTHROPIC_API_KEY` | Yes | Server-level fallback key |
| `CLICKUP_API_KEY` | Yes | Server-level fallback key |
| `CLICKUP_LIST_ID` | Yes | Default ClickUp list for ticket creation |
| `JWT_SECRET` | Yes (prod) | Fallback: `dev-secret-change-me` |
| `CRYPTO_SECRET` | Yes | AES-256-GCM key for encrypting `users.*_api_key` columns. Generate with `openssl rand -base64 32`. Losing it makes existing encrypted keys unrecoverable. |
| `ALLOWED_EMAIL_DOMAIN` | No | Restrict registration (e.g. `empresa.com`) |
| `SENTRY_DSN` | No | If set, errors are reported to Sentry. Omit in dev to disable. |
| `SENTRY_ENVIRONMENT` | No | Sentry environment tag. Default: `development`. |
| `PORT` | No | Default: `3000` |
