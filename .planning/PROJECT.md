# BugShot

## What This Is

Webapp interna para empleados instaladores y de soporte. Graba audio, transcribe en tiempo real con Web Speech API, resume con Claude API, y crea tickets en ClickUp con evidencia visual adjunta. Backend Node.js + Express como proxy para APIs.

v1.0 MVP shippeado: flujo completo audio → transcripción → resumen IA → ticket ClickUp con adjuntos.

## Core Value

El empleado graba, describe el problema hablando, y con un click tiene un ticket estructurado en ClickUp con toda la evidencia — sin escribir nada manualmente.

## Current Milestone: v1.1 Slack Notifications

**Goal:** Notificar al equipo en Slack automáticamente cada vez que se crea un ticket en ClickUp.

**Target features:**
- Notificación automática a Slack al crear ticket (Incoming Webhook + Block Kit)
- Mensaje con título, bullets y enlace al ticket
- Fire-and-forget: Slack nunca bloquea la creación del ticket

## Requirements

### Validated

- ✓ Estructura proyecto Express + HTML estático — v1.0
- ✓ Grabación de audio con MediaRecorder API — v1.0
- ✓ Transcripción en tiempo real con Web Speech API (auto-reinicio en silencio) — v1.0
- ✓ Resumen con Claude API (endpoint proxy, haiku) — v1.0
- ✓ Creación de tickets en ClickUp (endpoint proxy) — v1.0
- ✓ Adjuntar fotos/videos a tickets (multipart, preview) — v1.0

### Active (v1.1)

- [ ] Notificación Slack automática al crear ticket (Incoming Webhook)
- [ ] Mensaje Block Kit: título + bullets + reporter + enlace
- [ ] Fire-and-forget: fallo Slack no bloquea respuesta al frontend
- [ ] Warn en arranque si SLACK_WEBHOOK_URL no configurada

### Deferred (v1.2)

- [ ] Grabación de video (cámara) con audio simultáneo
- [ ] Selector de modo en UI: solo audio / video+audio
- [ ] localStorage guarda campos del formulario entre sesiones
- [ ] Progress bar durante subida de archivos
- [ ] Retry automático en errores de red
- [ ] Estados de carga claros en cada paso del flujo

### Out of Scope

- Autenticación de empleados — prototipo interno, acceso libre
- Hosting producción — prototipo en localhost
- App móvil nativa — webapp first
- Whisper/transcripción server-side — Web Speech API nativa del browser
- Almacenamiento externo de archivos — subida directa a ClickUp
- Grabación de pantalla — out of scope tras validar prioridades

## Context

- Usuarios: empleados instaladores y soporte técnico en campo
- Dispositivos: móvil y desktop (Chrome/Edge con soporte Web Speech API)
- ClickUp API Key y List ID configurados
- Claude API Key configurada (haiku para resumen)
- v1.0 shippeado — flujo core validado
- Design doc Slack: `docs/plans/2026-03-08-slack-notification-design.md`

## Constraints

- **Stack**: Node.js + Express backend, HTML/JS estático frontend — sin frameworks
- **APIs**: Web Speech API (browser), Claude API, ClickUp REST API, Slack Incoming Webhooks
- **Seguridad**: API keys en .env, backend como proxy — nunca exponer keys en frontend
- **Adjuntos**: Subida directa a ClickUp Attachments API (sin almacenamiento intermedio)
- **Browser**: Solo Chrome/Edge (Web Speech API requirement)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Backend Express como proxy | No exponer API keys en frontend | ✓ Funciona bien — zero leaks |
| Web Speech API vs Whisper | Sin dependencia de API key adicional, nativo del browser | ✓ Validado — auto-reinicio resuelve el timeout de silencio |
| ClickUp attachments directo | Simplifica el prototipo, sin almacenamiento externo | ✓ Funciona — multer multipart proxy |
| Campos manuales (username, projectId, assetId) | En modal, el usuario los introduce | ✓ Suficiente para v1.0 — localStorage en v1.2 |
| HTML/JS estático sin framework | Simplicidad máxima para herramienta interna | ✓ Adecuado — vanilla JS manejable con módulos ES |
| SpeechRecognition loop auto-reinicio | API para por timeout de silencio | ✓ Resuelto con `onend` → `start()` condicional |
| visualizer.js eliminado en 4.1 | Dead code — waveform reimplementado inline en app.js | ✓ Limpio |
| Slack Incoming Webhook (v1.1) | Sin infraestructura adicional, directo desde Express | — Pending |
| Slack fire-and-forget (v1.1) | Fallo Slack no bloquea ticket — UX prioritaria | — Pending |
| server/lib/slack.js módulo separado (v1.1) | Lógica Slack aislada y reutilizable | — Pending |

---
*Last updated: 2026-03-08 after v1.1 milestone start*
