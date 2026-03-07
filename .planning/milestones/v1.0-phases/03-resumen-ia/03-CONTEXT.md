# Phase 3: Resumen IA - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

La transcripcion se convierte en titulo sugerido + transcripcion limpia (con puntuacion) + bullets estructurados, usando Claude como proxy. La card del feed muestra el resultado automaticamente. La edicion del contenido y creacion de tickets son fase 4.

</domain>

<decisions>
## Implementation Decisions

### Formato del resumen
- Claude genera 3 outputs: titulo sugerido, transcripcion limpia con puntuacion inteligente, bullets de resumen
- Bullets libres (sin estructura fija tipo bug report), contenido adaptativo
- Numero de bullets adaptativo segun duracion/contenido de la grabacion
- Respuesta en JSON estructurado: `{ title, transcript, bullets[] }`
- Sin metadatos extra (categoria, prioridad) — eso es fase 4

### UI del resumen (referencia: How I AI)
- Al parar la grabacion, la card se crea automaticamente con la transcripcion cruda y estado "Processing" con spinner
- Badge en header: tipo (Audio/Video) + estado (Processing/Completed)
- Cuando Claude responde: la transcripcion cruda se reemplaza por la limpia, aparecen los bullets, estado cambia a Completed
- Boton "Crear Ticket" visible pero inactivo/deshabilitado (se activa en fase 4)
- Si Claude falla: estado "Error" + boton "Reintentar". La transcripcion cruda se mantiene
- Si la transcripcion esta vacia (no se detecto voz): card con mensaje "No se detecto voz", sin llamar a Claude

### Edicion del resultado
- La card del feed es de solo lectura
- Toda la edicion (titulo, descripcion, campos) ocurre en el modal de crear ticket (fase 4)
- RESU-03 se cumple via el modal de fase 4, no en esta fase

### Prompt y tono
- Idioma: siempre en espanol
- Tono: tecnico conciso, tipo ticket de soporte ("El campo X no muestra el valor introducido")
- Prompt generico, sin contexto de dominio especifico
- Modelo: Claude Haiku (rapido, barato, suficiente para resumir transcripciones)

### Streaming y limites
- Respuesta completa (no streaming) — con Haiku la espera es ~1-2s, aceptable
- Sin limite explicito de duracion de grabacion ni longitud de transcripcion para v1

### Claude's Discretion
- Diseno exacto del prompt (system + user)
- Estructura interna del endpoint /api/summarize
- Manejo de errores HTTP y timeouts
- Diseno visual del spinner y estados de la card

</decisions>

<specifics>
## Specific Ideas

- Referencia visual: How I AI — cards compactas con badge Audio/Video + estado Processing/Completed, transcripcion visible, bullets debajo, boton "Create Ticket" al final
- Flujo: grabar -> parar -> card aparece con transcripcion cruda + Processing -> Claude responde -> card se actualiza con transcripcion limpia + bullets + Completed
- Dos pasos claros: feed de cards (esta fase) vs modal de ticket (fase 4)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createCard()` en app.js: ya genera cards con header (timestamp + duracion) y body (texto). Se extiende para incluir badges y bullets
- `showToast()` en app.js: sistema de notificaciones reutilizable para errores
- `formatDuration()` en app.js: formateo de duracion ya implementado

### Established Patterns
- Vanilla JS con modulos ES6 (recorder.js, transcriber.js, visualizer.js)
- Tailwind CSS via CDN + CSS custom (styles.css)
- Cards en feed con `feed.prepend(card)` — patron de insercion al inicio
- Express server con `express.json()` middleware — listo para recibir POST con JSON

### Integration Points
- server/index.js: anadir ruta POST /api/summarize como proxy a Claude API
- app.js `createCard()`: extender para incluir llamada a /api/summarize tras crear la card
- .env: anadir ANTHROPIC_API_KEY

</code_context>

<deferred>
## Deferred Ideas

- Selector de App obligatorio (alfredSmart, lavidda, nunezNavarro, verticalsDemo) — fase 4
- Selector de Area funcional (Accesos/Cerraduras, Climatizacion, Iluminacion, Escenas/Automatizaciones, Notificaciones, Usuarios/Permisos, Otro) — fase 4
- Campos manuales: username, projectId, assetId — fase 4
- Contexto de dominio en el prompt (apps especificas) — valorar en futuro si mejora la calidad

</deferred>

---

*Phase: 03-resumen-ia*
*Context gathered: 2026-03-07*
