# Roadmap: BugShot

## Milestones

- ✅ **v1.0 MVP** — Phases 1–4 + 4.1 (shipped 2026-03-08)
- 🚧 **v1.1 Slack Notifications** — Phase 5 (active)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–4 + 4.1) — SHIPPED 2026-03-08</summary>

- [x] Phase 1: Estructura del Proyecto (1/1 plans) — completed 2026-03-07
- [x] Phase 2: Audio + Transcripcion (2/2 plans) — completed 2026-03-08
- [x] Phase 3: Resumen IA (1/1 plans) — completed 2026-03-08
- [x] Phase 4: Tickets + Adjuntos (2/2 plans) — completed 2026-03-07
- [x] Phase 4.1: Limpieza técnica / gap closure (1/1 plans) — completed 2026-03-08

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### 🚧 v1.1 Slack Notifications

- [ ] **Phase 5: Slack Notifications** — Notificación automática a Slack al crear ticket

## Phase Details

### Phase 5: Slack Notifications
**Goal**: Cada ticket creado en ClickUp dispara automáticamente una notificación en Slack con toda la información relevante, sin impactar la experiencia del usuario si Slack falla.
**Depends on**: Phase 4 (ticket creation endpoint — `/api/ticket`)
**Requirements**: SLCK-01, SLCK-02, SLCK-03, SLCK-04
**Success Criteria** (what must be TRUE):
  1. Al crear un ticket, aparece automáticamente un mensaje en el canal de Slack configurado sin ninguna acción adicional del usuario
  2. El mensaje de Slack muestra el título del ticket, los bullets del resumen y un enlace clickable al ticket en ClickUp
  3. Si Slack no responde o devuelve error, el ticket se crea igualmente y el frontend recibe la respuesta de éxito con normalidad
  4. Si SLACK_WEBHOOK_URL no está en .env al arrancar el servidor, aparece un aviso en consola y las notificaciones se omiten silenciosamente
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Estructura del Proyecto | v1.0 | 1/1 | Complete | 2026-03-07 |
| 2. Audio + Transcripcion | v1.0 | 2/2 | Complete | 2026-03-08 |
| 3. Resumen IA | v1.0 | 1/1 | Complete | 2026-03-08 |
| 4. Tickets + Adjuntos | v1.0 | 2/2 | Complete | 2026-03-07 |
| 4.1. Limpieza técnica | v1.0 | 1/1 | Complete | 2026-03-08 |
| 5. Slack Notifications | v1.1 | 0/1 | Not started | - |
