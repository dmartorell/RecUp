# Roadmap: BugShot

## Overview

BugShot transforma grabaciones de audio/video en tickets estructurados de ClickUp. El roadmap sigue la cadena de valor natural: primero la estructura del proyecto, luego captura de audio con transcripcion (core value), despues resumen IA, creacion de tickets con adjuntos, y finalmente video con camara y pulido UX. Cada fase produce el input que la siguiente necesita.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Estructura del Proyecto** - Express sirviendo HTML estatico con feature detection y UI base
- [ ] **Phase 2: Audio + Transcripcion** - Grabacion de audio con transcripcion via Web Speech API
- [ ] **Phase 3: Resumen IA** - Endpoint proxy a Claude API que genera titulo + descripcion estructurada
- [ ] **Phase 4: Tickets + Adjuntos** - Creacion de tickets en ClickUp con archivos adjuntos
- [ ] **Phase 5: Video + UX Polish** - Modo video con camara y mejoras de experiencia de usuario

## Phase Details

### Phase 1: Estructura del Proyecto
**Goal**: El proyecto arranca, el servidor sirve la app, y el usuario sabe inmediatamente si su navegador es compatible
**Depends on**: Nothing (first phase)
**Requirements**: ESTR-01, ESTR-02, ESTR-03
**Success Criteria** (what must be TRUE):
  1. Al ejecutar `npm start`, el servidor arranca y sirve la pagina principal en localhost
  2. Si el usuario abre la app en Firefox o Safari, ve un mensaje claro indicando que necesita Chrome/Edge
  3. La UI tiene estructura single-page con aspecto profesional (layout, colores, tipografia coherentes)
**Plans:** 1 plan

Plans:
- [ ] 01-01-PLAN.md — Servidor Express + feature detection + UI feed con Tailwind

### Phase 2: Audio + Transcripcion
**Goal**: El usuario puede grabar audio y obtener una transcripcion completa de lo que ha dicho
**Depends on**: Phase 1
**Requirements**: GRAB-01, GRAB-04, TRAN-01, TRAN-02, TRAN-03
**Success Criteria** (what must be TRUE):
  1. El usuario pulsa un boton, graba audio, y ve un indicador con la duracion y estado de grabacion activa
  2. Durante la grabacion, Web Speech API transcribe en espanol (es-ES) sin detenerse por pausas de silencio
  3. Al parar la grabacion, la transcripcion completa se muestra en pantalla lista para revisar
  4. La transcripcion no se pierde aunque el usuario haga pausas largas al hablar (auto-reinicio funciona)
**Plans**: TBD

Plans:
- [ ] 02-01: TBD

### Phase 3: Resumen IA
**Goal**: La transcripcion se convierte en un titulo y descripcion estructurada listos para un ticket
**Depends on**: Phase 2
**Requirements**: RESU-01, RESU-02, RESU-03
**Success Criteria** (what must be TRUE):
  1. El usuario pulsa "Resumir" y recibe un titulo conciso + bullets estructurados generados por Claude
  2. El endpoint /api/summarize funciona como proxy sin exponer la API key en el frontend
  3. El usuario puede editar tanto el titulo como la descripcion generados antes de continuar
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: Tickets + Adjuntos
**Goal**: El flujo completo audio-to-ticket funciona: el usuario graba, resume, y crea un ticket en ClickUp con evidencia adjunta
**Depends on**: Phase 3
**Requirements**: TICK-01, TICK-02, TICK-03, ADJU-01, ADJU-02, ADJU-03
**Success Criteria** (what must be TRUE):
  1. El usuario rellena campos del ticket en un modal (username, projectId, assetId) y crea el ticket en ClickUp
  2. El endpoint /api/ticket crea la tarea en ClickUp sin exponer credenciales en el frontend
  3. El usuario puede adjuntar fotos/videos desde galeria o camara y ver preview antes de enviar
  4. Los archivos adjuntos se suben al ticket creado via /api/attachment y el usuario recibe confirmacion con enlace al ticket
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

### Phase 5: Video + UX Polish
**Goal**: El usuario puede grabar video con camara ademas de audio, y la experiencia general es fluida y resistente a errores
**Depends on**: Phase 4
**Requirements**: GRAB-02, GRAB-03, UXPO-01, UXPO-02, UXPO-03, UXPO-04
**Success Criteria** (what must be TRUE):
  1. El usuario puede seleccionar entre modo "solo audio" y "video+audio" antes de grabar
  2. En modo video, la camara graba video con audio simultaneo y la transcripcion funciona igual que en modo audio
  3. Los campos del formulario (username, projectId, assetId) se recuerdan entre sesiones via localStorage
  4. Durante la subida de archivos, el usuario ve una barra de progreso y recibe feedback claro en cada paso del flujo
  5. Si hay un error de red, el sistema reintenta automaticamente sin que el usuario pierda su trabajo
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Estructura del Proyecto | 0/1 | Planning complete | - |
| 2. Audio + Transcripcion | 0/? | Not started | - |
| 3. Resumen IA | 0/? | Not started | - |
| 4. Tickets + Adjuntos | 0/? | Not started | - |
| 5. Video + UX Polish | 0/? | Not started | - |
