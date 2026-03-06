# BugShot

## What This Is

Webapp interna para empleados instaladores y de soporte. Graba audio/video/pantalla, transcribe en tiempo real con Web Speech API, resume con Claude API, y crea tickets en ClickUp con evidencia visual adjunta. Backend Node.js + Express como proxy para APIs.

## Core Value

El empleado graba, describe el problema hablando, y con un click tiene un ticket estructurado en ClickUp con toda la evidencia — sin escribir nada manualmente.

## Current Milestone: v1.0 Prototipo

**Goal:** Prototipo funcional completo con los tres modos de grabacion (audio/video/pantalla), transcripcion, resumen IA y creacion de tickets en ClickUp.

**Target features:**
- Grabacion de audio con transcripcion en tiempo real
- Resumen inteligente con Claude API
- Creacion de tickets en ClickUp con campos editables
- Adjuntar fotos/videos como evidencia
- Grabacion de video con camara + audio
- Grabacion de pantalla + audio

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Estructura proyecto Express + HTML estatico
- [ ] Grabacion de audio con MediaRecorder API
- [ ] Transcripcion en tiempo real con Web Speech API
- [ ] Resumen con Claude API (endpoint proxy)
- [ ] Creacion de tickets en ClickUp (endpoint proxy)
- [ ] Adjuntar fotos/videos a tickets
- [ ] Grabacion de video (camara) con audio simultaneo
- [ ] Grabacion de pantalla con audio

### Out of Scope

- Autenticacion de empleados — prototipo interno, acceso libre
- Hosting produccion — prototipo en localhost
- App movil nativa — webapp first
- Chat en tiempo real — no es el caso de uso
- Whisper/transcripcion server-side — Web Speech API nativa del browser
- Almacenamiento externo de archivos — subida directa a ClickUp

## Context

- Usuarios: empleados instaladores y soporte tecnico en campo
- Dispositivos: movil y desktop (navegadores modernos con soporte Web Speech API)
- ClickUp API Key y List ID ya disponibles
- Claude API Key pendiente de configurar
- Los tres modos de grabacion comparten patron: audio para transcripcion + video opcional como evidencia

## Constraints

- **Stack**: Node.js + Express backend, HTML/JS estatico frontend — sin frameworks
- **APIs**: Web Speech API (browser), Claude API, ClickUp REST API
- **Seguridad**: API keys en .env, backend como proxy — nunca exponer keys en frontend
- **Adjuntos**: Subida directa a ClickUp Attachments API (sin almacenamiento intermedio)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Backend Express como proxy | No exponer API keys en frontend | — Pending |
| Web Speech API vs Whisper | Sin dependencia de API key adicional, nativo del browser | — Pending |
| ClickUp attachments directo | Simplifica el prototipo, sin almacenamiento externo | — Pending |
| Campos manuales (username, projectId, assetId) | En modal, el usuario los introduce — suficiente para prototipo | — Pending |
| HTML/JS estatico sin framework | Simplicidad maxima para prototipo | — Pending |

---
*Last updated: 2026-03-07 after milestone v1.0 initialization*
