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
| 2. Audio + Transcripcion | v1.0 | 2/2 | Complete | 2026-03-08 |
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
- [ ] 01-02: Input de texto (textarea + botón Enviar + chrome.storage.session flow)
- [ ] 01-03: Grabación de audio (mic, waveform AnalyserNode, transcriber.js)
- [x] 01-04: Integración en la webapp (handleExtensionMode en app.js)
- [ ] 01-05: Polish + distribución (iconos 16/48/128px + verificación E2E)
