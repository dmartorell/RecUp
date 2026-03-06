# Pitfalls Research

**Domain:** Browser-based recording + transcription + ticketing webapp
**Researched:** 2026-03-07
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Web Speech API no funciona fuera de Chromium

**What goes wrong:**
SpeechRecognition solo funciona en Chrome y navegadores basados en Chromium (Edge). Firefox no lo soporta. Safari tiene soporte parcial e inconsistente. Brave lo rechaza explicitamente. El prototipo parece funcionar en desarrollo (Chrome desktop) y falla completamente cuando un instalador lo abre en Firefox o Safari movil.

**Why it happens:**
La spec Web Speech API no esta estandarizada entre navegadores. Chrome envia el audio a los servidores de Google para procesarlo -- requiere conexion a internet. No es una API local.

**How to avoid:**
- Detectar soporte al cargar la app: `'webkitSpeechRecognition' in window || 'SpeechRecognition' in window`
- Mostrar mensaje claro si no hay soporte: "Usa Chrome o Edge para transcripcion en tiempo real"
- Para el prototipo interno, es aceptable limitar a Chrome. Documentar esta restriccion prominentemente
- Futuro: fallback con Whisper API server-side para navegadores sin soporte

**Warning signs:**
- Funciona en tu maquina pero no en la del usuario
- `SpeechRecognition` es `undefined` en consola
- Silencio total sin errores visibles (la API simplemente no existe)

**Phase to address:**
Fase 1 (estructura base) -- detectar capacidades del navegador desde el primer momento y mostrar advertencias.

---

### Pitfall 2: SpeechRecognition se detiene silenciosamente en modo continuo

**What goes wrong:**
`continuous = true` no garantiza reconocimiento continuo. Chrome corta despues de 3-4 segundos de silencio. iOS ignora el flag completamente. Edge lanza errores de red constantes cuando no hay habla. El usuario graba 5 minutos hablando y solo se transcribe el primer parrafo.

**Why it happens:**
La implementacion de `continuous` varia entre navegadores y ninguno la mantiene activa de forma fiable. El timeout de inactividad es agresivo e incontrolable.

**How to avoid:**
- Escuchar el evento `onend` y reiniciar automaticamente `recognition.start()` en un loop
- Acumular resultados parciales (`onresult`) en un buffer externo, no depender del resultado final
- Implementar indicador visual de "escuchando" vs "pausado" para que el usuario sepa cuando esta activo
- En `onerror`, filtrar errores de tipo `no-speech` (no son fatales) y reiniciar

```javascript
recognition.onend = () => {
  if (isRecording) {
    recognition.start(); // auto-restart
  }
};
recognition.onerror = (e) => {
  if (e.error === 'no-speech') return; // ignorar, se reiniciara
  // manejar errores reales
};
```

**Warning signs:**
- Transcripcion que se "congela" durante la grabacion
- Solo aparece texto de los primeros segundos
- Eventos `onend` inesperados en los logs

**Phase to address:**
Fase 2 (grabacion de audio + transcripcion) -- implementar el loop de reinicio desde el principio, no como fix posterior.

---

### Pitfall 3: MediaRecorder produce formatos incompatibles entre navegadores

**What goes wrong:**
Chrome graba en WebM (VP8/VP9 + Opus). Safari historicamente solo soportaba MP4 (H.264 + AAC). Si el formato de un navegador se sube a ClickUp y alguien lo descarga en otro navegador/SO, puede no reproducirse. Safari 18.4+ ya soporta WebM, pero dispositivos con iOS antiguo no.

**Why it happens:**
La spec MediaRecorder no define formatos obligatorios. Cada navegador implementa los codecs que quiere. No hay un formato universal garantizado.

**How to avoid:**
- Usar `MediaRecorder.isTypeSupported()` para probar formatos en orden de preferencia:
  1. `video/webm;codecs=vp9,opus` (Chrome/Firefox)
  2. `video/webm;codecs=vp8,opus` (fallback WebM)
  3. `video/mp4;codecs=h264,aac` (Safari antiguo)
- Guardar el mimeType usado junto con la grabacion para referencia
- Para audio solo: preferir `audio/webm;codecs=opus` con fallback a `audio/mp4`
- WebM es el formato mas universal ahora con Safari 18.4+

**Warning signs:**
- Videos que se suben a ClickUp pero no se reproducen
- `MediaRecorder` lanza error al instanciar con mimeType especifico
- Archivos con extension correcta pero contenido corrupto

**Phase to address:**
Fase 2 (grabacion audio) y Fase 4 (grabacion video) -- negociacion de formato desde la primera grabacion.

---

### Pitfall 4: Memory leaks en grabaciones largas con MediaRecorder

**What goes wrong:**
Grabaciones de mas de 5-10 minutos consumen RAM creciente. Con canvas + audio combinado, Chrome puede pasar de 400MB a 1.2GB en 2 horas. Los chunks de `ondataavailable` pueden variar de 75KB a 50MB de forma impredecible. El navegador crashea o se vuelve inutilizable.

**Why it happens:**
MediaRecorder acumula datos en buffers internos. Si no se configuran `timeslice` en `start()`, todo se acumula en memoria hasta `stop()`. Los tracks que siguen vivos despues de `stop()` siguen alimentando los buffers del encoder.

**How to avoid:**
- Usar `timeslice` en `recorder.start(1000)` para obtener chunks cada segundo
- Acumular chunks en un array y liberar referencia cuando ya no se necesiten
- Detener explicitamente TODOS los tracks del stream al parar: `stream.getTracks().forEach(t => t.stop())`
- Para grabaciones largas (>5min), considerar escribir chunks a un Blob progresivamente
- Establecer un limite maximo de grabacion (ej: 10 minutos para un bug report es mas que suficiente)

**Warning signs:**
- Uso de memoria creciente durante grabacion (DevTools > Performance Monitor)
- Browser tab se vuelve lento progresivamente
- Crash sin error visible

**Phase to address:**
Fase 2 y Fase 4 -- implementar limpieza de recursos desde el primer dia. Poner limite de duracion maximo.

---

### Pitfall 5: getDisplayMedia no existe en movil

**What goes wrong:**
La captura de pantalla (`getDisplayMedia()`) no funciona en ningun navegador movil. El boton de "grabar pantalla" aparece en movil pero falla al pulsarlo. El instalador en campo, que usa el movil, no puede compartir pantalla.

**Why it happens:**
Los navegadores moviles no implementan `getDisplayMedia()`. En movil solo se comparte la pagina abierta, lo cual no tiene sentido. Es una limitacion fundamental de la plataforma, no un bug.

**How to avoid:**
- Detectar soporte: `'getDisplayMedia' in navigator.mediaDevices`
- Ocultar el boton de captura de pantalla en movil, no solo deshabilitarlo
- La captura de pantalla es un feature de desktop. En movil, ofrecer solo grabacion de camara + audio
- Documentar claramente que la grabacion de pantalla es solo para agentes de soporte en desktop

**Warning signs:**
- `navigator.mediaDevices.getDisplayMedia is not a function`
- Boton visible pero no funcional en movil
- Usuarios reportando que "no funciona" (porque ven un boton que no hace nada)

**Phase to address:**
Fase 5 (grabacion de pantalla) -- feature detection y UI adaptativa movil/desktop desde el inicio de esa fase.

---

### Pitfall 6: iOS Safari pide permisos de camara/micro en cada carga de pagina

**What goes wrong:**
Safari en iOS no persiste los permisos de camara/microfono entre sesiones. Cada vez que el usuario recarga o navega, Safari vuelve a pedir permiso. En PWAs, cambiar el hash de la URL revoca los permisos. El flujo del instalador se interrumpe constantemente.

**Why it happens:**
WebKit tiene una politica de permisos mucho mas restrictiva que Chrome. Apple prioriza privacidad sobre usabilidad en este caso. La Permissions API (`navigator.permissions.query`) no esta soportada en Safari para microfono/camara.

**How to avoid:**
- No navegar entre paginas. Usar una SPA (single page) con cambios de vista sin recarga
- Evitar cambios de hash en la URL si se anade como PWA a home screen
- Solicitar permisos solo cuando el usuario pulsa "Grabar", no al cargar la pagina
- Mostrar instrucciones claras: "Safari pedira permiso -- pulsa Permitir"
- Dado que el stack es HTML estatico sin framework, mantener todo en un unico HTML sin navegacion

**Warning signs:**
- Usuarios iOS reportando popups de permisos constantes
- Grabaciones que fallan intermitentemente en Safari
- `getUserMedia` devuelve error `NotAllowedError` sin que el usuario haya denegado

**Phase to address:**
Fase 1 (estructura) -- decidir la arquitectura single-page desde el inicio. Fase 2+ -- solicitar permisos solo on-demand.

---

### Pitfall 7: Subida de archivos grandes a ClickUp falla sin feedback

**What goes wrong:**
Videos de varios minutos pueden pesar cientos de MB. La subida a ClickUp Attachments API tarda minutos sin indicador de progreso. El usuario cierra la app pensando que se colgo. La conexion movil (4G) se corta y la subida falla silenciosamente. El ticket se crea sin adjuntos.

**Why it happens:**
ClickUp acepta hasta 1GB por adjunto, pero no hay retry automatico. `fetch()` no tiene eventos de progreso nativos. En movil con conexion inestable, uploads largos son inherentemente fragiles.

**How to avoid:**
- Usar `XMLHttpRequest` en lugar de `fetch()` para tener evento `progress` de subida
- Mostrar barra de progreso real durante la subida
- Comprimir video antes de subir (reducir resolucion, bitrate)
- Limitar duracion de grabacion (10 min max) para controlar tamano de archivo
- Separar la creacion del ticket de la subida de adjuntos: crear ticket primero, subir adjuntos despues
- Implementar retry con backoff exponencial para subidas fallidas
- Considerar subir audio (pequeno) inmediatamente y video (grande) en segundo plano

**Warning signs:**
- Tickets creados sin adjuntos
- Usuarios reportando "la app se quedo colgada"
- Errores de red sin manejo en consola

**Phase to address:**
Fase 3 (creacion de tickets en ClickUp) -- implementar progreso y retry desde el primer endpoint de subida.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Acumular toda la grabacion en memoria sin timeslice | Codigo mas simple | Crash en grabaciones largas | Never -- siempre usar timeslice |
| No detectar capabilities del navegador | Menos codigo de UI | Errores silenciosos en navegadores no soportados | Solo si se restringe a Chrome internamente |
| `fetch()` sin retry para ClickUp API | Implementacion rapida | Tickets sin adjuntos con conexion inestable | MVP prototipo en localhost con WiFi estable |
| Un unico blob de video sin chunks | Mas simple de implementar | Sin progreso de subida, sin resume | MVP solo si se limita duracion a 2 min |
| No limpiar tracks del MediaStream al parar | Parece funcionar | Memory leak progresivo | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| ClickUp Attachments API | Enviar JSON con base64 del archivo | Usar `multipart/form-data` -- es el unico formato aceptado |
| ClickUp Attachments API | Intentar adjuntar archivo al crear el task en un solo request | Son dos requests separados: 1) crear task, 2) POST attachment al task ID |
| ClickUp API | No comprobar rate limits | Leer headers `X-RateLimit-Remaining` y pausar si se acerca a 0. Free plan: 100 req/min |
| Claude API (via proxy) | Enviar transcripcion + video binario a Claude | Claude recibe texto. Enviar solo la transcripcion como texto para el resumen |
| Web Speech API | Asumir que `recognition.start()` funciona sin HTTPS | Requiere contexto seguro (HTTPS o localhost). No funciona en HTTP plano |
| MediaRecorder | Instanciar con mimeType hardcodeado | Siempre probar con `isTypeSupported()` primero |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Grabacion + transcripcion simultanea en movil | UI laggy, frames perdidos, transcripcion con gaps | Separar audio track para Speech API del video track. Usar `timeslice` cortos | Dispositivos moviles gama baja, grabaciones >3 min |
| Chunks de MediaRecorder acumulados en array JS | Memoria creciente, tab crash | Consolidar en Blob periodicamente, liberar array | Grabaciones >5 min en 1080p |
| Re-render de transcripcion en cada palabra | DOM updates bloqueando UI | Usar `requestAnimationFrame` o throttle para actualizar texto cada 200ms | Transcripciones largas con muchos resultados parciales |
| Subida sincrona de adjuntos grandes | App bloqueada hasta completar upload | Subir en background, mostrar progreso, permitir al usuario seguir usando la app | Archivos >50MB en conexion movil |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| API keys de Claude/ClickUp en el frontend JS | Keys expuestas en DevTools, cualquiera puede usarlas | Backend Express como proxy -- ya contemplado en el proyecto |
| No validar tamano de archivo en el backend proxy | Un archivo enorme puede crashear el servidor Express | `express.json({limit})` y validacion de Content-Length antes de proxear a ClickUp |
| CORS abierto `*` en el backend proxy | Cualquier web puede usar tu proxy como API gateway | Restringir CORS al origen de la webapp |
| Almacenar grabaciones temporales en el servidor sin cleanup | Disco lleno, datos sensibles persistidos | Stream directo a ClickUp sin guardar en disco. Si se guarda temporalmente, borrar despues de subir |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No indicar que el micro esta activo | Usuario no sabe si esta grabando o no | Indicador visual prominente (rojo pulsante) + timer de duracion |
| Pedir permisos de camara al cargar la pagina | Popup inesperado, usuario deniega por reflejo | Pedir solo cuando el usuario pulsa "Grabar", con explicacion previa |
| Transcripcion que desaparece al reiniciar SpeechRecognition | Usuario pierde texto ya transcrito | Acumular en buffer externo, no depender del estado interno de la API |
| Formulario de ticket con muchos campos obligatorios | Instalador en campo abandona el flujo | Minimo de campos manuales. Pre-rellenar lo posible. Resumen IA como default editable |
| No mostrar preview del video antes de subir | Usuario sube video equivocado o corrupto | Reproducir en un `<video>` element antes de crear el ticket |
| Boton de "grabar pantalla" visible en movil | Confusion, click que falla | Ocultar features no soportadas segun plataforma |

## "Looks Done But Isn't" Checklist

- [ ] **Transcripcion:** Funciona en Chrome pero no se ha probado en Safari/Edge -- verificar con `isTypeSupported` y feature detection
- [ ] **Grabacion de video:** Se graba pero el archivo resultante no tiene audio -- verificar que el MediaStream tiene audio track activo
- [ ] **Captura de pantalla:** Funciona pero no captura audio del sistema -- `getDisplayMedia` con `audio: true` no es soportado en todos los navegadores, y el usuario debe seleccionar "Compartir audio del sistema"
- [ ] **Subida a ClickUp:** El ticket se crea pero sin adjuntos -- verificar que el attachment POST usa multipart/form-data con el task ID correcto
- [ ] **Resumen IA:** Claude genera resumen pero se pierde al recargar -- persistir en variable/localStorage antes de crear ticket
- [ ] **Cleanup de streams:** La grabacion para visualmente pero el LED del micro/camara sigue encendido -- verificar que todos los tracks se detienen con `track.stop()`
- [ ] **Mobile:** La app "funciona" en desktop pero en movil los botones se superponen, los permisos fallan, y no hay scroll al formulario largo

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Web Speech API no soportado | MEDIUM | Anadir endpoint Whisper en backend, cambiar frontend para enviar audio blob en vez de usar API nativa |
| Formato de video incompatible | LOW | Transcodificar server-side con ffmpeg antes de subir a ClickUp |
| Memory leak en grabacion | LOW | Anadir timeslice, cleanup de tracks, limite de duracion. No requiere cambio de arquitectura |
| Permisos iOS repetidos | LOW | Reestructurar a single-page sin cambios de URL. Cambio de arquitectura menor |
| Subida grande falla | MEDIUM | Implementar retry + progreso. Si se necesita chunked upload, ClickUp API no lo soporta nativamente |
| Tickets sin adjuntos | LOW | Verificar respuesta del POST attachment, reintentar si falla, notificar al usuario |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Web Speech API solo Chromium | Fase 1 (estructura) | Feature detection implementado, mensaje de navegador no soportado visible |
| SpeechRecognition se detiene | Fase 2 (audio + transcripcion) | Grabar 5 min con pausas de silencio, verificar transcripcion completa |
| Formatos MediaRecorder incompatibles | Fase 2 (audio) y Fase 4 (video) | `isTypeSupported()` con fallback chain implementado |
| Memory leaks en grabaciones | Fase 2 y Fase 4 | Grabar 10 min, monitorear memoria en DevTools, verificar que no crece linealmente |
| getDisplayMedia no existe en movil | Fase 5 (pantalla) | Abrir en movil, verificar que boton de pantalla no aparece |
| iOS permisos repetidos | Fase 1 (estructura) | Probar en iPhone Safari: recargar pagina, verificar flujo de permisos |
| Subida grande sin progreso | Fase 3 (ClickUp) | Subir video de 100MB, verificar barra de progreso y retry en fallo |

## Sources

- [Can I Use - Speech Recognition](https://caniuse.com/speech-recognition)
- [MDN - Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Taming the Web Speech API - Andrea Giammarchi](https://webreflection.medium.com/taming-the-web-speech-api-ef64f5a245e1)
- [Web Speech API continuous listening issue #99](https://github.com/WebAudio/web-speech-api/issues/99)
- [Can I Use - MediaRecorder](https://caniuse.com/mediarecorder)
- [Recording cross-browser compatible media - Media Codings](https://media-codings.com/articles/recording-cross-browser-compatible-media)
- [Chrome MP4 MediaRecorder support](https://chromestatus.com/feature/5163469011943424)
- [WebKit MediaRecorder API blog](https://webkit.org/blog/11353/mediarecorder-api/)
- [MDN - getDisplayMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia)
- [ClickUp API - Attachments](https://developer.clickup.com/docs/attachments)
- [ClickUp API - Rate Limits](https://developer.clickup.com/docs/rate-limits)
- [Firefox MediaRecorder memory leak - Bug 1376134](https://bugzilla.mozilla.org/show_bug.cgi?id=1376134)
- [Electron MediaRecorder memory leak - Issue #41123](https://github.com/electron/electron/issues/41123)
- [Dealing with huge MediaRecorder chunks - Addpipe](https://blog.addpipe.com/dealing-with-huge-mediarecorder-slices/)
- [getUserMedia getting started 2026 - Addpipe](https://blog.addpipe.com/getusermedia-getting-started/)
- [Safari getUserMedia permission issues - WebKit Bug 215884](https://bugs.webkit.org/show_bug.cgi?id=215884)
- [iPhone Safari MediaRecorder recording - Build with Matija](https://www.buildwithmatija.com/blog/iphone-safari-mediarecorder-audio-recording-transcription)

---
*Pitfalls research for: BugShot -- browser recording + transcription + ticketing webapp*
*Researched: 2026-03-07*
