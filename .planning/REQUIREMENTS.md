# Requirements: BugShot

**Defined:** 2026-03-08
**Core Value:** El empleado graba, describe el problema hablando, y con un click tiene un ticket estructurado en ClickUp con toda la evidencia — sin escribir nada manualmente.

## v1.1 Requirements

### Slack Notifications

- [ ] **SLCK-01**: Al crear un ticket en ClickUp, el servidor envía automáticamente una notificación a Slack
- [ ] **SLCK-02**: La notificación incluye título del ticket, bullets del resumen y enlace al ticket (formato Block Kit)
- [ ] **SLCK-03**: Si la llamada a Slack falla, el ticket se crea igualmente (fire-and-forget — error solo en log del servidor)
- [ ] **SLCK-04**: Si SLACK_WEBHOOK_URL no está configurada en .env, el servidor muestra un aviso al arrancar y omite la notificación

## v1.2 Requirements (Deferred)

### Video + UX Polish

- **GRAB-02**: Grabación de video (cámara) con audio simultáneo
- **GRAB-03**: Selector de modo en UI: solo audio / video+audio
- **UXPO-01**: localStorage guarda campos del formulario entre sesiones
- **UXPO-02**: Progress bar durante subida de archivos
- **UXPO-03**: Retry automático en errores de red
- **UXPO-04**: Estados de carga claros en cada paso del flujo

## Out of Scope

| Feature | Reason |
|---------|--------|
| Autenticación de empleados | Prototipo interno, acceso libre |
| Hosting producción | Prototipo en localhost |
| App móvil nativa | Webapp first |
| Whisper/transcripción server-side | Web Speech API nativa del browser |
| Almacenamiento externo de archivos | Subida directa a ClickUp |
| Grabación de pantalla | Validado fuera de scope tras review de prioridades |
| Mensajes Slack configurables | Formato fijo suficiente para herramienta interna |
| Múltiples canales Slack | Un canal via webhook, suficiente para v1.1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SLCK-01 | Phase 5 | Pending |
| SLCK-02 | Phase 5 | Pending |
| SLCK-03 | Phase 5 | Pending |
| SLCK-04 | Phase 5 | Pending |

**Coverage:**
- v1.1 requirements: 4 total
- Mapped to phases: 4
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-08*
*Last updated: 2026-03-08 after v1.1 milestone start*
