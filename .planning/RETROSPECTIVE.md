# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-08
**Phases:** 5 (1–4 + 4.1) | **Plans:** 7

### What Was Built

- Servidor Express + UI single-page, feature detection Chrome/Edge
- Grabación de audio + transcripción en tiempo real (Web Speech API con auto-reinicio)
- Resumen IA via Claude Haiku — título + bullets desde transcripción
- Endpoints proxy ClickUp: crear ticket + adjuntar archivos
- Modal de creación de ticket con preview de adjuntos, flujo completo audio-to-ticket
- Gap closure: dead code eliminado + bug coerción corregido

### What Worked

- **Vanilla JS con módulos ES** — suficiente para la complejidad del proyecto, sin overhead de framework
- **Backend como proxy único** — mantiene todas las API keys en servidor, patrón limpio y seguro
- **SpeechRecognition loop con auto-reinicio** — resuelve el timeout de silencio de forma elegante
- **GSD planning** — fases cortas y bien delimitadas facilitan ejecución sin sorpresas
- **Audit post-milestone** — identificó dead code y bug de coerción antes de cerrar v1.0

### What Was Inefficient

- **visualizer.js** — se creó en Phase 2 y quedó huérfano cuando el waveform se reimplementó inline. Debería haberse eliminado en Phase 2.
- **Numeración de fases 4.1** — el directorio sin padding (`4.1-limpieza-tecnica`) no fue detectado por `gsd-tools init`, requirió rutas manuales durante ejecución

### Patterns Established

- `SpeechRecognition` necesita loop de auto-reinicio: `recognition.onend = () => { if (isRecording) recognition.start(); }`
- Multer como middleware para proxy de multipart a ClickUp funciona bien en Express
- Modal con estado interno + `AttachmentManager` como clase independiente — patrón reutilizable
- Deuda técnica capturada en audit y cerrada en fase decimal (4.1) antes de completar milestone

### Key Lessons

1. El auto-reinicio de SpeechRecognition es imprescindible — sin él la transcripción para en cuanto hay silencio
2. Comparar arrays con `> 0` en JS produce coerción silenciosa — siempre usar `.length > 0`
3. Phase 5 (video + UX polish) se puede diferir sin bloquear el core value del producto
4. El flujo ClickUp (ticket + attachment) requiere 2 API calls separadas — planificarlo desde el inicio

### Cost Observations

- Model mix: sonnet para executor/verifier/researcher/checker
- Pipeline GSD completo en ~1 día de trabajo
- Notable: fases cortas (1-2 planes) ejecutan en minutos sin sobrecarga de coordinación

---

## Cross-Milestone Trends

| Milestone | Phases | Plans | Timeline | Notes |
|-----------|--------|-------|----------|-------|
| v1.0 MVP | 5 | 7 | 1 día | Primera iteración — flujo core completo |
