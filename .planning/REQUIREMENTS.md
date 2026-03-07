# Requirements: BugShot

**Defined:** 2026-03-07
**Core Value:** El empleado graba, describe el problema hablando, y con un click tiene un ticket estructurado en ClickUp con toda la evidencia.

## v1 Requirements

### Estructura

- [x] **ESTR-01**: Proyecto Express sirve HTML/JS/CSS estatico con .env para credenciales
- [x] **ESTR-02**: Feature detection avisa si el navegador no es compatible (Chromium requerido)
- [x] **ESTR-03**: UI single-page con CSS moderno y estilo profesional

### Grabacion

- [x] **GRAB-01**: Usuario puede grabar audio con MediaRecorder API
- [ ] **GRAB-02**: Usuario puede grabar video (camara) con audio simultaneo
- [ ] **GRAB-03**: Selector de modo en la UI: solo audio / video+audio
- [x] **GRAB-04**: Indicador visual de grabacion activa (duracion, estado)

### Transcripcion

- [x] **TRAN-01**: Web Speech API transcribe durante la grabacion (es-ES)
- [x] **TRAN-02**: Transcripcion completa se muestra al parar la grabacion
- [x] **TRAN-03**: Auto-reinicio de SpeechRecognition en pausas de silencio

### Resumen IA

- [x] **RESU-01**: Endpoint /api/summarize proxy a Claude API
- [x] **RESU-02**: Claude genera titulo + bullets estructurados a partir de la transcripcion
- [x] **RESU-03**: Usuario puede editar titulo y descripcion antes de crear ticket

### Tickets

- [x] **TICK-01**: Endpoint /api/ticket proxy a ClickUp API para crear tareas
- [x] **TICK-02**: Modal con campos editables para crear el ticket
- [x] **TICK-03**: Confirmacion de exito con enlace al ticket creado

### Adjuntos

- [x] **ADJU-01**: Usuario puede adjuntar fotos/videos desde galeria o camara
- [x] **ADJU-02**: Preview de archivos adjuntos antes de crear el ticket
- [x] **ADJU-03**: Endpoint /api/attachment sube archivos al ticket en ClickUp

### UX Polish

- [ ] **UXPO-01**: localStorage guarda campos del formulario entre sesiones
- [ ] **UXPO-02**: Progress bar durante subida de archivos
- [ ] **UXPO-03**: Retry automatico en errores de red
- [ ] **UXPO-04**: Estados de carga claros en cada paso del flujo

## v2 Requirements

### Captura de Pantalla

- **SCRN-01**: Grabacion de pantalla con Screen Capture API (solo desktop)
- **SCRN-02**: Audio del microfono mezclado con captura de pantalla via WebAudio API
- **SCRN-03**: Selector de modo ampliado: audio / video / pantalla

### Infraestructura

- **INFR-01**: Autenticacion de empleados
- **INFR-02**: Hosting en produccion
- **INFR-03**: Transcripcion en tiempo real visible durante grabacion

## Out of Scope

| Feature | Reason |
|---------|--------|
| App movil nativa | Webapp first, movil via browser |
| Chat en tiempo real | No es el caso de uso |
| Whisper/transcripcion server-side | Web Speech API nativa suficiente para prototipo |
| Almacenamiento externo de archivos | Subida directa a ClickUp, sin almacenamiento intermedio |
| Dashboard o historial | Prototipo single-flow, sin persistencia de sesiones |
| OAuth/SSO | Prototipo interno, acceso libre |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ESTR-01 | Phase 1 | Complete |
| ESTR-02 | Phase 1 | Complete |
| ESTR-03 | Phase 1 | Complete |
| GRAB-01 | Phase 2 | Complete |
| GRAB-02 | Phase 5 | Pending |
| GRAB-03 | Phase 5 | Pending |
| GRAB-04 | Phase 2 | Complete |
| TRAN-01 | Phase 2 | Complete |
| TRAN-02 | Phase 2 | Complete |
| TRAN-03 | Phase 2 | Complete |
| RESU-01 | Phase 3 | Complete |
| RESU-02 | Phase 3 | Complete |
| RESU-03 | Phase 4 | Complete |
| TICK-01 | Phase 4 | Complete |
| TICK-02 | Phase 4 | Complete |
| TICK-03 | Phase 4 | Complete |
| ADJU-01 | Phase 4 | Complete |
| ADJU-02 | Phase 4 | Complete |
| ADJU-03 | Phase 4 | Complete |
| UXPO-01 | Phase 5 | Pending |
| UXPO-02 | Phase 5 | Pending |
| UXPO-03 | Phase 5 | Pending |
| UXPO-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-07 after roadmap creation*
