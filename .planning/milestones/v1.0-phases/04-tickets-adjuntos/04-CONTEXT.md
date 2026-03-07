# Phase 4: Tickets + Adjuntos - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

El flujo completo audio-to-ticket: el usuario graba, resume con Claude, y crea un ticket en ClickUp con evidencia adjunta. Incluye endpoints proxy para ClickUp (crear tarea + subir adjuntos), modal de creacion, captura de archivos, y feedback del resultado.

</domain>

<decisions>
## Implementation Decisions

### Flujo de creacion
- Boton "Crear ticket" en cada card de transcripcion (1 card = 1 ticket)
- Al pulsar, primero se llama a Claude para generar resumen (Phase 3), luego se abre el modal con titulo + descripcion pre-llenados
- Los adjuntos son opcionales — el ticket se puede crear solo con titulo y descripcion
- El audio de la grabacion NO se adjunta automaticamente — solo archivos que el usuario seleccione explicitamente

### Campos del modal
- Titulo (editable, pre-llenado por Claude)
- Descripcion (NO editable, generada por Claude)
- Reportado por (texto libre — quien usa BugShot)
- Usuario afectado (texto libre — el usuario con el problema, puede ser distinto del que reporta)
- Project ID (texto libre)
- Asset ID (texto libre)

### Captura de adjuntos
- Boton "Anadir archivo" con input file estandar (galeria en movil, explorador en desktop)
- Boton separado para abrir camara directa y hacer foto/video en el momento
- Maximo 5 archivos por ticket
- Maximo 10 MB por archivo
- Validacion de limites en frontend antes de enviar

### Feedback post-envio
- Progress bar dentro del modal durante creacion del ticket + subida de adjuntos
- Al completar: la card se marca como enviada (badge verde, icono check) — no se elimina
- Toast de confirmacion con enlace al ticket en ClickUp (abre en nueva pestana)
- La card tambien muestra el enlace al ticket
- Si falla la subida de un adjunto pero el ticket ya se creo: mostrar error parcial indicando que adjuntos fallaron, con opcion de reintentar

### Claude's Discretion
- Diseno del preview de adjuntos (thumbnails vs lista)
- Estilo visual del modal (layout, spacing)
- Texto exacto de los estados de progreso
- Diseno del badge de "enviada" en la card

</decisions>

<specifics>
## Specific Ideas

- El flujo es secuencial: grabar -> resumir -> modal -> enviar. Cada paso depende del anterior
- ClickUp requiere 2 API calls separadas: crear tarea + adjuntar archivos (no se puede hacer en una sola llamada)
- Los endpoints proxy (/api/ticket, /api/attachment) ocultan las credenciales del frontend

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createCard()` en app.js: genera cards de transcripcion — se extendera con boton "Crear ticket"
- `showToast()` en app.js: sistema de notificaciones toast reutilizable para confirmaciones y errores
- `server/index.js`: Express server basico — se anadiran rutas en server/routes/

### Established Patterns
- Vanilla JS con manipulacion DOM directa (createElement, innerHTML)
- Tailwind CSS via CDN browser build para estilos
- ES modules (import/export) en el frontend
- Express con dotenv para credenciales en el backend

### Integration Points
- Cada card en el feed necesita boton "Crear ticket" (modificar createCard())
- server/routes/ directorio vacio (.gitkeep) — aqui van /api/ticket y /api/attachment
- .env ya tiene CLICKUP_API_KEY y CLICKUP_LIST_ID configurados
- CLAUDE_API_KEY en .env para el endpoint de resumen (Phase 3)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-tickets-adjuntos*
*Context gathered: 2026-03-07*
