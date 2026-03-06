# Phase 2: Audio + Transcripcion - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

El usuario puede grabar audio y obtener una transcripcion completa de lo que ha dicho. Cada grabacion genera una card con la transcripcion. Multiples grabaciones se acumulan como un feed de cards. No incluye resumen IA, creacion de tickets, ni modo video.

</domain>

<decisions>
## Implementation Decisions

### Controles de grabacion
- Boton toggle unico: circulo rojo grande con icono de microfono. Al grabar, cambia a icono de stop con animacion
- Sin confirmacion al detener — pulsar = para inmediatamente
- Permiso de microfono se solicita al cargar la pagina, no al pulsar grabar
- Cada grabacion crea una nueva card (no reemplaza la anterior)
- Boton "Limpiar todo" para resetear todas las cards acumuladas
- Cada card tiene boton eliminar (x) individual

### Indicador de grabacion
- Timer con duracion (MM:SS) + waveform funcional (barras que reaccionan al audio real via AnalyserNode)
- Al detener, el indicador se desvanece y da paso a la card de transcripcion (transicion suave)

### Presentacion de la transcripcion
- Cards apiladas tipo feed (referencia: How I AI) — cada grabacion es una card independiente
- Cards son solo lectura — la edicion ocurre en el modal de creacion de ticket (Phase 3-4)
- Separador visual entre sesiones de grabacion (cada card tiene su propio contexto)
- Cada card muestra: texto transcrito, timestamp/duracion

### Feedback durante grabacion
- Sin subtitulos en vivo — el texto completo aparece solo al parar la grabacion
- El waveform funcional es el unico feedback de que el micro esta captando
- Si Web Speech API falla durante la grabacion: toast/notificacion avisando del problema (la grabacion de audio continua)
- Si la transcripcion falla completamente: la card se crea con mensaje "No se pudo transcribir este audio"

### Claude's Discretion
- Ubicacion del indicador de grabacion en la pagina (sobre el boton, header, etc.)
- Diseno exacto de las cards (spacing, tipografia, sombras)
- Animaciones y transiciones
- Manejo exacto del auto-reinicio de SpeechRecognition en pausas de silencio

</decisions>

<specifics>
## Specific Ideas

- Referencia visual: How I AI (app de feedback con grabacion de audio) — cards apiladas con transcripcion inline, estado "Completed", timestamps
- El boton de grabacion debe ser prominente y central, tipo "call to action" principal de la pagina
- Las cards deben ser limpias y legibles, no sobrecargadas

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- No hay codigo existente — Phase 1 (Estructura del Proyecto) aun no se ha ejecutado

### Established Patterns
- Stack definido: Node.js + Express (proxy) + HTML/JS/CSS vanilla (sin framework)
- Solo Chromium requerido — se puede usar Web Speech API y MediaRecorder sin polyfills

### Integration Points
- Se construye sobre la UI base de Phase 1 (Express sirviendo HTML estatico)
- MediaRecorder API para captura de audio (el blob se usara como adjunto en Phase 4)
- Web Speech API (es-ES) para transcripcion con auto-reinicio por timeout de silencio
- Las cards de transcripcion alimentan el flujo de Phase 3 (Resumen IA)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-audio-transcripcion*
*Context gathered: 2026-03-07*
