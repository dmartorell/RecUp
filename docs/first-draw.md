# Alfred Feedback Tool — Plan de Proyecto

## Visión General

Webapp interna para empleados instaladores y de soporte. Permite grabar audio/pantalla, transcribir, resumir problemas identificados y crear tickets en ClickUp. Fase futura incluye un bot de Slack para automatizar el flujo de resolución de bugs.

---

## Stack Técnico Decidido

| Capa | Tecnología | Motivo |
|------|-----------|--------|
| Grabación de audio | MediaRecorder API (browser nativo) | Sin dependencias externas |
| Grabación de pantalla | Screen Capture API (browser nativo) | Sin dependencias externas |
| Transcripción | Web Speech API (browser nativo) | Gratuita, tiempo real, suficiente calidad para casos de uso interno |
| Resumen + bullets + título | Claude API (Anthropic) | La empresa ya tiene suscripción activa |
| Creación de tickets | ClickUp REST API | Herramienta de gestión actual de la empresa |
| Frontend | HTML/JS (webapp standalone) | Acceso universal para todos los empleados sin instalación |

> **Nota:** Whisper (OpenAI) fue evaluado como primera opción para transcripción pero descartado para evitar dependencia de API key adicional. Web Speech API es suficiente para el caso de uso.

---

## Funcionalidades de la Fase 1

### Grabación
- [ ] Grabación de **audio/voz** con MediaRecorder API
- [ ] Grabación de **pantalla** con Screen Capture API
- [ ] Ambas modalidades independientes (no necesariamente simultáneas en F1)

### Transcripción
- [ ] Transcripción en tiempo real con Web Speech API
- [ ] Visualización del texto transcrito en pantalla durante la grabación

### Análisis con Claude
- [ ] Envío de la transcripción a Claude API
- [ ] Claude genera:
  - Título sugerido para el ticket
  - Lista de bullets con los problemas identificados

### Creación de Ticket en ClickUp
- [ ] Botón "Crear ticket en ClickUp"
- [ ] Modal de confirmación con:
  - Título del ticket (editable)
  - Descripción con bullets generados por Claude
  - Campos extra: `username`, `projectId`, `assetId`
- [ ] Llamada a ClickUp REST API para crear el issue
- [ ] Modal de éxito con enlace al ticket creado

---

## Fases del Proyecto

### Fase 1 — Webapp Core ✅ (actual)
Webapp grabadora → transcripción → resumen IA → ticket ClickUp.
**Valor:** usable por el equipo desde el día 1.

### Fase 1.5 — Notificación automática a Slack al crear ticket
Cuando BugShot crea un ticket en ClickUp, el servidor llama directamente a Slack API para enviar un mensaje al canal designado con el título, descripción y enlace al ticket.
**Implementación:** Incoming Webhook de Slack + llamada desde el servidor Express justo después de crear el ticket en ClickUp. Sin webhooks externos ni infraestructura adicional.
**Valor:** el equipo se entera al instante de cada nuevo ticket sin revisar ClickUp manualmente.

### Fase 2 — Slack Bot (análisis)
Command `@Frontend Bot plan {project} {ticketId}` que analiza el ticket y propone qué hacer.
**Dependencia:** servidor backend (Node.js) para recibir webhooks de Slack.

### Fase 3 — Slack Bot (create-pr)
Command `@Frontend Bot create-pr {project} {ticketUrl}` que:
- Crea rama en GitHub/GitLab
- Genera PR con contexto del ticket
- Responde con link a la rama + QR Expo para testear en móvil

### Fase 4 — Agente autónomo de código
Agente que propone cambios de código en la rama para resolver el bug.
**Alto riesgo / alto valor.** Requiere acceso al repo y prompt engineering avanzado.

### Fase 5 — Vinculación automática al asset
Automatizar la vinculación del usuario al asset para debugging.
**Dependencia:** acceso a endpoint interno de `@alfred_developes/cloud-core-front` o scraping de la admin app.

---

## Requisitos Previos Pendientes

- [ ] **ClickUp API Key** (Settings → Apps → API Token)
- [ ] **ClickUp List ID** donde se crearán los tickets (visible en la URL de la lista)
- [ ] Decisión sobre **hosting** de la webapp (¿dónde la desplegamos para que accedan todos los empleados?)

---

## Pendiente de Definir

1. ¿La webapp requiere autenticación de empleados o es acceso libre interno?
2. ¿Los campos `username`, `projectId` y `assetId` se introducen manualmente en el modal del ticket o se obtienen de algún sistema?
3. ¿El vídeo de pantalla se adjunta al ticket o solo se usa para contexto visual durante la grabación?
4. ¿Dónde se hostea la webapp? (opciones: Vercel, servidor interno, Netlify...)
