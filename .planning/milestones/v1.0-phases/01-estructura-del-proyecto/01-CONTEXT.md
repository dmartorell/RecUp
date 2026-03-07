# Phase 1: Estructura del Proyecto - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Express sirviendo HTML estatico con feature detection y UI base. El servidor arranca, sirve la app, y el usuario sabe si su navegador es compatible. La UI establece el sistema visual y layout que todas las fases posteriores heredan.

</domain>

<decisions>
## Implementation Decisions

### Estilo visual
- Light clean: fondo claro (#ffffff/#f5f5f5), cards blancas con sombra sutil
- Tipografia: Inter (Google Fonts)
- Color de acento: azul #2a54ae
- Bordes redondeados 8-12px
- CSS: Tailwind CDN (sin build step)

### Layout y flujo
- Patron feed tipo "How I AI" de Anthropic: grabaciones como cards apiladas en columna centrada
- Max-width ~700px, centrado horizontal
- Botones de accion (video + audio) flotantes en la parte inferior, siempre accesibles
- Responsive: desktop + movil (en movil la card ocupa todo el ancho con padding)
- Header: solo nombre "BugShot", minimalista
- Empty state: icono centrado + texto invitando a grabar (como How I AI)

### Cards de grabacion
- Badges de estado tipo chip: "Audio", "Procesando", "Completado"
- Timestamp relativo ("hace 1 minuto")
- Contenido: transcripcion original + bullets generados por IA
- Boton "Crear Ticket en ClickUp" por card

### Flujo de procesamiento
- Automatico: al parar grabacion -> transcribe -> resume con IA -> muestra card con bullets + boton ticket
- Sin pasos intermedios manuales entre grabacion y resultado

### Modal de ticket
- Modal con campos pre-rellenados por IA (titulo, descripcion), editables por el usuario
- Campos ClickUp: usuario, proyecto, asset ID
- Confirmacion: modal de exito con enlace directo al ticket en ClickUp

### Mensaje de compatibilidad
- Pagina bloqueante: si no es Chromium, la app no carga en absoluto
- Pantalla completa explicando que necesita Chrome o Edge
- Tono amigable: "Tu navegador no soporta las APIs que necesitamos. Prueba con Chrome o Edge."
- Enlace a descargar Chrome

### Estructura del servidor
- Carpetas con separacion server/ y src/:
  - server/index.js (Express, rutas)
  - server/routes/ (endpoints API)
  - src/index.html, src/js/app.js, src/css/styles.css
- ES Modules (type: module en package.json)
- Puerto 3000
- nodemon para desarrollo (npm run dev)
- .env para credenciales

### Claude's Discretion
- Espaciado y tamanios exactos de tipografia
- Diseno del loading skeleton / spinner durante procesamiento
- Animaciones de transicion entre estados de card
- Estructura interna de los archivos JS (modulos, clases, etc)
- Icono exacto del empty state

</decisions>

<specifics>
## Specific Ideas

- "Quiero que se parezca a How I AI de Anthropic" — referencia visual principal (screenshots proporcionados)
- Feed de grabaciones como cards apiladas, no wizard ni flujo step-by-step
- Botones flotantes abajo como en How I AI (video + audio)
- Cards con badge de tipo/estado + timestamp + transcripcion + bullets
- Modal de creacion de ticket como en How I AI pero para ClickUp en vez de Linear

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- No hay codigo existente — proyecto desde cero

### Established Patterns
- Ninguno — esta fase establece los patrones base

### Integration Points
- Express servira archivos estaticos desde src/
- .env ya definido como patron para credenciales (ClickUp API key)
- Las rutas /api/* se definiran en server/routes/ para fases posteriores

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-estructura-del-proyecto*
*Context gathered: 2026-03-07*
