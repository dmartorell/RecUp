# Roadmap: BugShot

## Milestones

- ✅ **v1.0 MVP** — Phases 1–4 + 4.1 (shipped 2026-03-08)

## Phases

### ✅ v1.0 MVP (Phases 1–4 + 4.1) — SHIPPED 2026-03-08

- [x] Phase 1: Estructura del Proyecto (1/1 plans) — completed 2026-03-07
- [x] Phase 2: Audio + Transcripcion (2/2 plans) — completed 2026-03-08
- [x] Phase 3: Resumen IA (1/1 plans) — completed 2026-03-08
- [x] Phase 4: Tickets + Adjuntos (2/2 plans) — completed 2026-03-07
- [x] Phase 4.1: Limpieza técnica / gap closure (1/1 plans) — completed 2026-03-08

Full details: `.planning/milestones/v1.0-ROADMAP.md`

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Estructura del Proyecto | 5/5 | Complete   | 2026-03-13 | 2026-03-07 |
| 2. Audio + Transcripcion | 4/4 | Complete   | 2026-03-14 | 2026-03-08 |
| 3. Resumen IA | v1.0 | 1/1 | Complete | 2026-03-08 |
| 4. Tickets + Adjuntos | v1.0 | 2/2 | Complete | 2026-03-07 |
| 4.1. Limpieza técnica | v1.0 | 1/1 | Complete | 2026-03-08 |

### Phase 1: Extensión Chrome para Bugshot

**Goal:** Extensión Chrome (Manifest V3) que permite reportar bugs desde cualquier pestaña, pasando contenido de texto o audio a la webapp via chrome.storage.session
**Requirements**: EXT-SCAFFOLD, EXT-LOGIN, EXT-TEXT-INPUT, EXT-AUDIO, EXT-WEBAPP-INTEGRATION, EXT-POLISH
**Depends on:** Phase 0
**Plans:** 5/5 plans complete

Plans:
- [x] 01-01: Scaffolding + Login (manifest, popup.html, chrome.storage.local auth) — completed 2026-03-13
- [x] 01-02: Input de texto (textarea + botón Enviar + chrome.storage.session flow)
- [x] 01-03: Grabación de audio (mic, waveform AnalyserNode, transcriber.js)
- [x] 01-04: Integración en la webapp (handleExtensionMode en app.js)
- [x] 01-05: Polish + distribución (iconos 16/48/128px + verificación E2E)

### Phase 2: Base de datos simple para gestión de usuarios y asociación de cards

**Goal:** SQLite con bun:sqlite para persistencia de usuarios (registro, login, sesiones con token) y cards (transcripción, resumen, estado ClickUp). Cards privadas por usuario. Sin almacenamiento de audio.
**Requirements**: DB-SCHEMA, DB-AUTH, DB-CARDS, DB-SEED, DB-WEBAPP, DB-FEED, DB-EXT
**Depends on:** Phase 1
**Plans:** 4/4 plans complete

Plans:
- [x] 02-01-PLAN.md — Backend: SQLite schema, auth API (login/register), cards CRUD, seed script — completed 2026-03-14
- [x] 02-02-PLAN.md — Webapp: login/registro contra API real, cards persistidas en DB, feed desde API
- [x] 02-03-PLAN.md — Extension Chrome: login via API real, token real en flujo
- [x] 02-04-PLAN.md — Gap closure: eliminar fallback 'local' en handleExtensionMode
