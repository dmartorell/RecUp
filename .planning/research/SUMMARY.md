# Project Research Summary

**Project:** BugShot
**Domain:** Internal bug reporting webapp — media capture + transcription + AI summarization + ticket creation
**Researched:** 2026-03-07
**Confidence:** HIGH

## Executive Summary

BugShot es una webapp interna que convierte grabaciones de audio/video/pantalla en tickets de ClickUp estructurados, pasando por transcripcion en tiempo real (Web Speech API) y resumen con IA (Claude). El stack es intencionalmente minimalista: Node.js 22 + Express 5 como proxy backend, HTML/JS estatico sin framework como frontend, y solo 5 dependencias de produccion. Este enfoque es el correcto para un prototipo interno donde la velocidad de entrega importa mas que la escalabilidad.

El factor de riesgo dominante es la **dependencia de Web Speech API**, que solo funciona fiablemente en Chromium (Chrome/Edge). Esto es aceptable para una herramienta interna donde se puede exigir Chrome, pero debe comunicarse desde el primer momento con feature detection y mensajes claros. El segundo riesgo es la **fragilidad del modo continuo de SpeechRecognition**, que se detiene silenciosamente tras segundos de silencio y requiere un patron de auto-reinicio implementado desde el dia uno.

La arquitectura es un proxy pass-through: el frontend maneja toda la captura y transcripcion con APIs del navegador, y el backend solo reenvuelve peticiones a Claude y ClickUp inyectando credenciales. No hay base de datos, no hay estado en el servidor, no hay build step. La creacion de tickets en ClickUp requiere dos llamadas secuenciales (crear tarea + adjuntar archivo), y el manejo de fallos parciales en este flujo es critico para evitar tickets sin evidencia.

## Key Findings

### Recommended Stack

Stack minimalista con 5 dependencias de produccion. El backend es un proxy stateless; toda la logica pesada ocurre en el browser.

**Core technologies:**
- **Node.js 22 LTS + Express 5.x**: Runtime y servidor HTTP. Express 5 es default en npm, async error handling nativo. Sin razones para versiones anteriores.
- **@anthropic-ai/sdk**: Cliente oficial Claude API. Maneja retries, rate limits, streaming. No usar fetch manual.
- **Web Speech API (browser)**: Transcripcion en tiempo real, gratis, sin servidor. Solo Chromium. Soporta `es-ES`.
- **MediaRecorder API (browser)**: Grabacion audio/video/pantalla como WebM. Cross-browser con negociacion de formato.
- **multer + form-data**: Recepcion y reenvio de archivos multipart al ClickUp Attachments API.

**Anti-stack (no usar):** axios (fetch nativo), TypeScript (build step innecesario), frameworks frontend (complejidad sin beneficio), base de datos (no hay que persistir), WebSockets (no hay push server).

### Expected Features

**Must have (table stakes):**
- Grabacion audio con un click (start/stop)
- Transcripcion en tiempo real visible durante grabacion
- Transcripcion editable antes de enviar
- Resumen IA con Claude (titulo + bullets estructurados)
- Creacion de ticket ClickUp con campos manuales (username, projectId, assetId)
- Adjuntar archivo de evidencia al ticket
- Selector de modo (audio/video/pantalla)
- Timer de grabacion + indicador visual de estado

**Should have (diferenciadores):**
- Preview/reproduccion de grabacion antes de enviar
- localStorage para recordar campos recientes
- Foto rapida desde camara
- Soporte de multiples adjuntos por ticket

**Defer (v2+):**
- Transcripcion server-side con Whisper (solo si Web Speech API resulta insuficiente)
- Soporte offline con sync
- Configuracion de campos custom de ClickUp
- Creacion de tickets en lote

### Architecture Approach

Arquitectura de dos capas: frontend SPA (single HTML page) con modulos ES nativos, y backend Express con 3 rutas proxy independientes. El frontend orquesta el flujo completo (grabar, transcribir, resumir, crear ticket). El backend solo inyecta credenciales y reenvia peticiones.

**Major components:**
1. **Recording Module** (recorder.js) — abstrae los 3 modos de grabacion con MediaRecorder
2. **Transcription Module** (transcriber.js) — Web Speech API con auto-reinicio continuo
3. **UI Controller** (app.js + ui.js) — estado como objeto plano, render por fases (idle/recording/review/editing/done)
4. **API Client** (api.js) — fetch wrapper para las 3 rutas del backend
5. **Express Proxy** (server/) — 3 rutas: /api/summarize, /api/ticket, /api/attachment

### Critical Pitfalls

1. **Web Speech API solo Chromium** — Detectar soporte al cargar la app, mostrar mensaje claro si no hay soporte. Aceptable para prototipo interno.
2. **SpeechRecognition se detiene silenciosamente** — Implementar loop de auto-reinicio en `onend` desde el dia uno. Acumular resultados en buffer externo.
3. **MediaRecorder formatos incompatibles** — Usar `isTypeSupported()` con cadena de fallback (webm vp9 > webm vp8 > mp4).
4. **Memory leaks en grabaciones largas** — Usar `timeslice` en `recorder.start(1000)`, limpiar todos los tracks al parar, limitar duracion a 10 min.
5. **Subida de archivos grandes sin feedback** — Usar XMLHttpRequest para progreso, implementar retry con backoff, separar creacion de ticket de subida de adjunto.

## Implications for Roadmap

### Phase 1: Estructura del proyecto + servidor Express
**Rationale:** Todo depende de tener el proyecto configurado y el backend proxy funcional. Feature detection del navegador debe estar desde el inicio.
**Delivers:** Proyecto Node.js funcional con Express sirviendo HTML estatico. Endpoints proxy stub. Deteccion de capacidades del navegador.
**Addresses:** Estructura proyecto, Express proxy, feature detection
**Avoids:** Pitfall 1 (Web Speech API solo Chromium), Pitfall 6 (iOS permisos — SPA sin navegacion)

### Phase 2: Grabacion de audio + transcripcion en tiempo real
**Rationale:** Es la pieza central del producto. Audio es el modo mas simple y la transcripcion es el core value. Ambos deben funcionar juntos antes de anadir complejidad.
**Delivers:** Grabar audio, ver transcripcion en vivo, editar transcripcion, preview de grabacion.
**Addresses:** Audio recording, real-time transcription, editable transcript, recording timer
**Avoids:** Pitfall 2 (SpeechRecognition se detiene), Pitfall 3 (formatos incompatibles), Pitfall 4 (memory leaks)

### Phase 3: Resumen IA con Claude API
**Rationale:** Depende de tener transcripcion funcional. Es el segundo pilar de valor: de texto crudo a ticket estructurado.
**Delivers:** Endpoint /api/summarize funcional. UI para generar, ver y editar resumen. Prompt engineering para formato de ticket.
**Addresses:** AI summary generation, editable summary
**Avoids:** Enviar datos innecesarios a Claude (solo texto, no binario)

### Phase 4: Creacion de tickets en ClickUp + adjuntos
**Rationale:** Depende del resumen para tener contenido del ticket. La integracion con ClickUp cierra el flujo completo audio-to-ticket.
**Delivers:** Crear ticket en ClickUp con campos editables. Adjuntar archivo de evidencia. Confirmacion con enlace al ticket.
**Addresses:** ClickUp ticket creation, file attachment, manual fields, success confirmation
**Avoids:** Pitfall 7 (subida sin feedback), Anti-pattern 4 (fallos parciales ticket+adjunto)

### Phase 5: Grabacion de video (camara) + foto
**Rationale:** Extiende el modo de captura una vez que el flujo audio-to-ticket esta validado. Video comparte la misma pipeline de transcripcion.
**Delivers:** Modo video con camara + audio simultaneo. Captura de foto rapida. Ambos como adjuntos adicionales.
**Addresses:** Video recording, photo capture, multiple attachments

### Phase 6: Grabacion de pantalla + audio
**Rationale:** Modo mas complejo tecnicamente (requiere WebAudio API para mezclar audio del sistema + micro). Solo relevante en desktop.
**Delivers:** Captura de pantalla con audio del micro. UI adaptativa que oculta este modo en movil.
**Addresses:** Screen recording, audio stream mixing
**Avoids:** Pitfall 5 (getDisplayMedia no existe en movil)

### Phase 7: Pulido y UX final
**Rationale:** Una vez todo funciona, optimizar la experiencia del usuario en campo.
**Delivers:** localStorage para campos recientes, limites de grabacion, indicadores visuales pulidos, manejo de errores completo, mobile-first CSS.
**Addresses:** localStorage, permission handling, recording preview, error recovery

### Phase Ordering Rationale

- **Fases 1-4 son secuenciales por dependencia:** cada fase produce el input que la siguiente necesita (estructura > audio+transcripcion > resumen > ticket).
- **Fases 5-6 son extensiones independientes:** anaden modos de captura sin cambiar la pipeline core. Podrian desarrollarse en paralelo.
- **Fase 7 es transversal:** pulido que toca todas las fases anteriores, mejor hacerlo al final cuando el flujo esta estable.
- **Audio primero, video despues, pantalla al final:** ordenado por complejidad creciente y por probabilidad de uso en campo (instaladores usan audio > foto > video > pantalla).

### Research Flags

Fases que probablemente necesiten research adicional durante planificacion:
- **Phase 4 (ClickUp):** La API de ClickUp tiene particularidades con custom fields y rate limits (100 req/min free plan). Necesita research de la API especifica del workspace del equipo.
- **Phase 6 (Screen recording):** Audio mixing con WebAudio API tiene poca documentacion y comportamiento variable entre navegadores. Necesita pruebas empiricas.

Fases con patrones bien documentados (saltar research):
- **Phase 1 (Estructura):** Express 5 + static files es patron estandar.
- **Phase 2 (Audio + transcripcion):** MediaRecorder y Web Speech API tienen documentacion extensa en MDN.
- **Phase 3 (Claude API):** SDK oficial con ejemplos claros.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Todas las tecnologias verificadas con fuentes oficiales. Versiones y compatibilidades confirmadas. |
| Features | HIGH | Feature landscape bien mapeado con analisis de competidores (Loom, Jam). Prioridades claras. |
| Architecture | HIGH | Patron proxy pass-through es estandar y bien documentado. Estructura de proyecto concreta. |
| Pitfalls | HIGH | Pitfalls verificados con bugs reportados, issues de GitHub, y documentacion MDN. Soluciones concretas para cada uno. |

**Overall confidence:** HIGH

### Gaps to Address

- **ClickUp custom fields:** No se ha investigado la estructura exacta de custom fields del workspace del equipo. Necesita validacion con la API real durante Phase 4.
- **Web Speech API precision en espanol:** La calidad de transcripcion en `es-ES` para vocabulario tecnico de instalaciones no esta validada. Probar empiricamente en Phase 2.
- **Chrome Android conflicto MediaRecorder + SpeechRecognition:** Reportado en foros pero no confirmado en versiones recientes de Chrome. Probar en dispositivo real en Phase 2.
- **Limites reales de ClickUp Attachments:** El limite oficial es 1GB, pero no se ha verificado el plan actual del equipo. Confirmar antes de Phase 4.

## Sources

### Primary (HIGH confidence)
- [MDN: Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) — compatibilidad, limitaciones
- [MDN: MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) — formatos, timeslice
- [MDN: getDisplayMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia) — soporte movil
- [Can I Use: Speech Recognition](https://caniuse.com/speech-recognition) — Chromium-only confirmado
- [Can I Use: MediaRecorder](https://caniuse.com/mediarecorder) — cross-browser support
- [ClickUp API: Tasks + Attachments](https://developer.clickup.com/reference/createtaskattachment) — flujo de dos pasos
- [Express 5.1.0 announcement](https://expressjs.com/2025/03/31/v5-1-latest-release.html) — Express 5 default
- [Node.js Releases](https://nodejs.org/en/about/previous-releases) — Node 22 LTS

### Secondary (MEDIUM confidence)
- [Chrome Android SpeechRecognition + MediaRecorder conflict](https://support.google.com/chrome/thread/364791156) — conflicto reportado
- [Dealing with huge MediaRecorder slices - Addpipe](https://blog.addpipe.com/dealing-with-huge-mediarecorder-slices/) — memory management
- [Safari getUserMedia permission issues - WebKit Bug 215884](https://bugs.webkit.org/show_bug.cgi?id=215884) — iOS permisos

### Tertiary (LOW confidence)
- [Web Speech API continuous listening issue #99](https://github.com/WebAudio/web-speech-api/issues/99) — comportamiento de `continuous` mode, spec abierta

---
*Research completed: 2026-03-07*
*Ready for roadmap: yes*
