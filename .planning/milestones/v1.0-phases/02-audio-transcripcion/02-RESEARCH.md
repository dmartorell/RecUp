# Phase 2: Audio + Transcripcion - Research

**Researched:** 2026-03-07
**Domain:** Web Speech API + MediaRecorder API + Web Audio API (visualizacion)
**Confidence:** HIGH

## Summary

Esta fase combina tres APIs del navegador: **MediaRecorder** para capturar audio, **Web Speech API (SpeechRecognition)** para transcribir en tiempo real, y **Web Audio API (AnalyserNode)** para el waveform visual. Las tres son nativas de Chromium y no requieren librerias externas.

El reto principal es el **auto-reinicio de SpeechRecognition**: Chrome corta la sesion tras ~60s de audio o ~3-4s de silencio, incluso con `continuous: true`. La solucion estandar es reiniciar en el evento `onend`, acumulando `final_transcript` entre sesiones. Hay un pitfall critico en **Chrome Android** donde MediaRecorder bloquea SpeechRecognition (no captura audio), pero como esta es una herramienta interna desktop-first, se puede mitigar con deteccion y aviso.

**Recomendacion principal:** Usar un unico `getUserMedia` stream compartido entre MediaRecorder, SpeechRecognition y AnalyserNode. Acumular transcripcion final en variable global, reiniciar recognition en `onend`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Boton toggle unico: circulo rojo grande con icono de microfono. Al grabar, cambia a icono de stop con animacion
- Sin confirmacion al detener — pulsar = para inmediatamente
- Permiso de microfono se solicita al cargar la pagina, no al pulsar grabar
- Cada grabacion crea una nueva card (no reemplaza la anterior)
- Boton "Limpiar todo" para resetear todas las cards acumuladas
- Cada card tiene boton eliminar (x) individual
- Timer con duracion (MM:SS) + waveform funcional (barras que reaccionan al audio real via AnalyserNode)
- Al detener, el indicador se desvanece y da paso a la card de transcripcion (transicion suave)
- Cards apiladas tipo feed — cada grabacion es una card independiente
- Cards son solo lectura
- Cada card muestra: texto transcrito, timestamp/duracion
- Sin subtitulos en vivo — el texto completo aparece solo al parar la grabacion
- El waveform funcional es el unico feedback de que el micro esta captando
- Si Web Speech API falla durante la grabacion: toast/notificacion avisando del problema (la grabacion de audio continua)
- Si la transcripcion falla completamente: la card se crea con mensaje "No se pudo transcribir este audio"

### Claude's Discretion
- Ubicacion del indicador de grabacion en la pagina (sobre el boton, header, etc.)
- Diseno exacto de las cards (spacing, tipografia, sombras)
- Animaciones y transiciones
- Manejo exacto del auto-reinicio de SpeechRecognition en pausas de silencio

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GRAB-01 | Usuario puede grabar audio con MediaRecorder API | MediaRecorder con `audio/webm;codecs=opus`, chunks via `ondataavailable`, blob final al parar |
| GRAB-04 | Indicador visual de grabacion activa (duracion, estado) | Timer MM:SS con setInterval + waveform con AnalyserNode.getByteFrequencyData en requestAnimationFrame loop |
| TRAN-01 | Web Speech API transcribe durante la grabacion (es-ES) | SpeechRecognition con `continuous:true`, `interimResults:true`, `lang:'es-ES'` — corre en paralelo a MediaRecorder |
| TRAN-02 | Transcripcion completa se muestra al parar la grabacion | Acumular `final_transcript` en variable global durante grabacion, mostrar en card al detener |
| TRAN-03 | Auto-reinicio de SpeechRecognition en pausas de silencio | Reiniciar `recognition.start()` en evento `onend` mientras grabacion este activa; usar flag `isRecording` para controlar |
</phase_requirements>

## Standard Stack

### Core (APIs nativas — sin dependencias externas)

| API | Purpose | Why Standard |
|-----|---------|--------------|
| MediaRecorder API | Captura audio del microfono en WebM/Opus | Nativa en Chromium, sin polyfill necesario |
| SpeechRecognition (webkitSpeechRecognition) | Transcripcion speech-to-text | Nativa en Chromium, gratis, sin API key |
| AudioContext + AnalyserNode | Waveform visual reactivo | Web Audio API nativa, datos de frecuencia en tiempo real |
| getUserMedia | Acceso al microfono | MediaDevices API nativa |

### Supporting

| Recurso | Purpose | When to Use |
|---------|---------|-------------|
| `requestAnimationFrame` | Loop de renderizado del waveform | Siempre que el indicador de grabacion este visible |
| `setInterval` | Timer MM:SS de duracion | Durante grabacion activa |
| CSS transitions/animations | Transicion suave entre estados | Al iniciar/detener grabacion |

**Installation:** Ninguna — todo es API nativa del navegador.

## Architecture Patterns

### Estructura de archivos para esta fase

```
public/
├── js/
│   ├── recorder.js       # MediaRecorder + audio capture
│   ├── transcriber.js    # SpeechRecognition wrapper con auto-restart
│   ├── visualizer.js     # AnalyserNode + canvas/CSS waveform
│   └── app.js            # Orquestacion, UI state, cards
├── css/
│   └── styles.css        # Estilos de cards, boton, waveform
└── index.html
```

### Pattern 1: Stream compartido

Un unico `getUserMedia` stream alimenta los tres consumidores.

```javascript
// Source: MDN getUserMedia + MediaRecorder + Web Audio API
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

// 1. MediaRecorder para grabar
const mediaRecorder = new MediaRecorder(stream, {
  mimeType: 'audio/webm;codecs=opus'
});

// 2. AudioContext para waveform
const audioCtx = new AudioContext();
const analyser = audioCtx.createAnalyser();
const source = audioCtx.createMediaStreamSource(stream);
source.connect(analyser);
// NO conectar a destination (evita feedback)

// 3. SpeechRecognition usa el microfono automaticamente (no necesita stream)
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.continuous = true;
recognition.interimResults = true;
recognition.lang = 'es-ES';
```

### Pattern 2: Acumulacion de transcripcion con auto-reinicio

```javascript
// Source: Chrome Developer Blog - Voice Driven Web Apps
let finalTranscript = '';
let isRecording = false;

recognition.onresult = (event) => {
  for (let i = event.resultIndex; i < event.results.length; i++) {
    if (event.results[i].isFinal) {
      finalTranscript += event.results[i][0].transcript;
    }
  }
};

recognition.onend = () => {
  if (isRecording) {
    // Auto-reinicio: Chrome corta tras silencio o timeout
    recognition.start();
  }
};

recognition.onerror = (event) => {
  if (event.error === 'no-speech' && isRecording) {
    // Silencio detectado — el onend se disparara y reiniciara
    return;
  }
  if (event.error === 'aborted' && isRecording) {
    return; // Ignorar abort durante restart
  }
  // Error real: notificar al usuario
  showToast('Error de transcripcion: ' + event.error);
};
```

### Pattern 3: Waveform con AnalyserNode (barras de frecuencia)

```javascript
// Source: MDN Visualizations with Web Audio API
analyser.fftSize = 256;
const bufferLength = analyser.frequencyBinCount; // 128 bins
const dataArray = new Uint8Array(bufferLength);

function drawWaveform() {
  if (!isRecording) return;
  requestAnimationFrame(drawWaveform);

  analyser.getByteFrequencyData(dataArray);

  // Usar un subset de barras (ej: 8-16 barras visibles)
  const barCount = 12;
  const step = Math.floor(bufferLength / barCount);
  for (let i = 0; i < barCount; i++) {
    const value = dataArray[i * step];
    const height = (value / 255) * 100; // porcentaje
    bars[i].style.height = `${Math.max(4, height)}%`;
  }
}
```

### Pattern 4: Ciclo de grabacion completo

```javascript
function startRecording() {
  finalTranscript = '';
  audioChunks = [];
  isRecording = true;
  startTime = Date.now();

  mediaRecorder.start();
  recognition.start();
  drawWaveform();
  startTimer();
}

function stopRecording() {
  isRecording = false;
  mediaRecorder.stop();
  recognition.stop();
  stopTimer();
}

mediaRecorder.ondataavailable = (e) => {
  if (e.data.size > 0) audioChunks.push(e.data);
};

mediaRecorder.onstop = () => {
  const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
  createCard(finalTranscript, audioBlob, elapsed);
};
```

### Anti-Patterns to Avoid
- **Crear AudioContext antes de interaccion del usuario:** Chrome requiere gesto de usuario para activar AudioContext. Crearlo al cargar la pagina genera warning. Crearlo en el primer click o usar `audioCtx.resume()`.
- **Conectar AnalyserNode a `audioCtx.destination`:** Genera feedback de audio (el usuario se oye a si mismo). Conectar solo source -> analyser, sin salida.
- **Confiar en `continuous: true` sin auto-reinicio:** Chrome corta igualmente tras timeout. El `onend` handler es obligatorio.
- **No verificar `e.data.size > 0` en ondataavailable:** Puede recibir chunks vacios.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Formato de audio | Encoder custom / WAV manual | `MediaRecorder` con `audio/webm;codecs=opus` | Opus comprime bien, MediaRecorder lo hace nativo |
| Speech-to-text | Whisper / API externa | `SpeechRecognition` nativa | Gratis, sin servidor, suficiente para prototipo interno |
| Visualizacion de audio | Analisis FFT manual | `AnalyserNode.getByteFrequencyData` | Web Audio API lo calcula internamente |
| Timer de duracion | Date arithmetic manual | `setInterval` + `Date.now() - startTime` | Patron estandar, simple, preciso |

## Common Pitfalls

### Pitfall 1: Chrome Android — MediaRecorder bloquea SpeechRecognition
**What goes wrong:** En Chrome Android, cuando MediaRecorder y AudioContext estan activos, SpeechRecognition no captura audio. La sesion se inicia pero nunca produce transcripcion.
**Why it happens:** Conflicto no documentado en la gestion del microfono en Android.
**How to avoid:** Detectar plataforma. En Android, mostrar aviso de limitacion o desactivar grabacion simultanea. Para esta app (herramienta interna desktop), documentar la limitacion y seguir adelante.
**Warning signs:** `recognition.onresult` nunca se dispara pese a que `recognition.onstart` si se ejecuto.

### Pitfall 2: Rate-limiting en reinicios rapidos de SpeechRecognition
**What goes wrong:** Si se reinicia `recognition.start()` demasiado rapido tras un error `no-speech`, Chrome puede hacer rate-limiting y las sesiones terminan instantaneamente.
**Why it happens:** Google limita la frecuencia de solicitudes al servicio de reconocimiento.
**How to avoid:** Anadir un delay minimo (~300ms) antes de reiniciar tras error `no-speech`. No reiniciar en errores que no sean `no-speech` o `aborted`.
**Warning signs:** `onend` se dispara inmediatamente tras `start()`, sin siquiera un `onstart`.

### Pitfall 3: AudioContext requiere gesto de usuario
**What goes wrong:** `new AudioContext()` en Chrome queda en estado `suspended` si se crea sin gesto de usuario.
**Why it happens:** Autoplay policy de Chrome — audio requiere interaccion del usuario.
**How to avoid:** Crear AudioContext en el handler del click de grabar, o llamar `audioCtx.resume()` en el primer click. No crearlo al cargar la pagina.
**Warning signs:** `audioCtx.state === 'suspended'` y el waveform no reacciona.

### Pitfall 4: Permiso de microfono y getUserMedia timing
**What goes wrong:** Si `getUserMedia` se llama al cargar la pagina y el usuario deniega, no hay forma de re-solicitar sin recargar.
**Why it happens:** La decision del usuario queda cacheada en la sesion del navegador.
**How to avoid:** El CONTEXT.md dice solicitar permiso al cargar. Implementar: si se deniega, mostrar mensaje claro con instruccion de como reactivar el micro en la barra de direcciones de Chrome.
**Warning signs:** `getUserMedia` rechaza con `NotAllowedError`.

### Pitfall 5: Perdida de transcripcion entre reinicios
**What goes wrong:** Al reiniciar SpeechRecognition, `event.resultIndex` vuelve a 0. Si se usa mal, se sobreescribe el texto previo.
**Why it happens:** Cada sesion de recognition es independiente — los indices se resetean.
**How to avoid:** Usar `finalTranscript` como variable persistente fuera del handler. Solo concatenar resultados `isFinal`. Nunca resetear `finalTranscript` en el `onresult` handler.
**Warning signs:** Texto que desaparece o se duplica al hablar tras una pausa.

## Code Examples

### Solicitar permiso de microfono al cargar
```javascript
// Source: MDN getUserMedia
async function requestMicrophoneAccess() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Guardar stream para uso posterior
    return stream;
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      showToast('Permiso de microfono denegado. Activa el microfono en la barra de direcciones.');
    } else if (err.name === 'NotFoundError') {
      showToast('No se encontro microfono.');
    }
    return null;
  }
}
```

### Crear card de transcripcion
```javascript
function createCard(transcript, audioBlob, duration) {
  const card = document.createElement('div');
  card.className = 'card';

  const text = transcript.trim() || 'No se pudo transcribir este audio';
  const durationStr = formatDuration(duration);
  const timestamp = new Date().toLocaleTimeString('es-ES');

  card.innerHTML = `
    <div class="card-header">
      <span class="card-time">${timestamp} · ${durationStr}</span>
      <button class="card-delete" aria-label="Eliminar">&times;</button>
    </div>
    <div class="card-body">
      <p class="card-text">${text}</p>
    </div>
  `;

  card.querySelector('.card-delete').addEventListener('click', () => card.remove());

  // Guardar blob como data attribute para Phase 4
  card.dataset.audioBlobUrl = URL.createObjectURL(audioBlob);

  document.querySelector('.cards-feed').prepend(card);
}
```

### Timer MM:SS
```javascript
let timerInterval;
let startTime;

function startTimer() {
  startTime = Date.now();
  timerInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    timerDisplay.textContent = formatDuration(elapsed);
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  return Date.now() - startTime;
}

function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const sec = String(totalSec % 60).padStart(2, '0');
  return `${min}:${sec}`;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `webkitSpeechRecognition` only | `SpeechRecognition \|\| webkitSpeechRecognition` | Chrome 110+ (2023) | Chrome soporta ambos prefijos; Edge tambien |
| `navigator.getUserMedia()` | `navigator.mediaDevices.getUserMedia()` | 2017+ | El viejo esta deprecated, usar siempre mediaDevices |
| `createMediaStreamSource` + manual FFT | `AnalyserNode` built-in | Estable desde 2014 | No reinventar la rueda |
| `AudioContext()` | `AudioContext()` (Safari elimino `webkitAudioContext` en 2023) | Safari 14.1+ | Ya no hace falta prefijo webkit para Safari |

**Deprecated/outdated:**
- `webkitAudioContext`: Ya no necesario, `AudioContext` funciona en todos los navegadores modernos
- `navigator.getUserMedia()`: Usar `navigator.mediaDevices.getUserMedia()`
- `SpeechGrammarList`: Deprecated en la especificacion, no usar

## Open Questions

1. **Duracion maxima de grabacion continua**
   - What we know: MediaRecorder no tiene limite hard; SpeechRecognition corta cada ~60s pero se reinicia
   - What's unclear: Estabilidad tras 10+ minutos de grabacion continua con multiples reinicios
   - Recommendation: Testear empiricamente en Phase 2. Si hay problemas, considerar limite soft de 5-10 min con aviso

2. **Precision de Web Speech API en vocabulario tecnico**
   - What we know: Google's speech service funciona bien para lenguaje general en es-ES
   - What's unclear: Precision con terminos tecnicos de instalaciones/mantenimiento
   - Recommendation: Validar empiricamente. El texto es editable en fases posteriores (Phase 3-4 modal)

## Sources

### Primary (HIGH confidence)
- [MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition) — Propiedades, eventos, estructura de resultados
- [MDN Web Audio Visualizations](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Visualizations_with_Web_Audio_API) — AnalyserNode, getByteFrequencyData, canvas rendering
- [MDN MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) — Captura de audio, ondataavailable, blob handling
- [Chrome Dev Blog - Voice Driven Web Apps](https://developer.chrome.com/blog/voice-driven-web-apps-introduction-to-the-web-speech-api) — Patron canonico de continuous recognition con interimResults

### Secondary (MEDIUM confidence)
- [Chrome Community - MediaRecorder + SpeechRecognition conflict](https://support.google.com/chrome/thread/364791156) — Conflicto en Android
- [GitHub WebAudio/web-speech-api #99 - Continuously listening](https://github.com/WebAudio/web-speech-api/issues/99) — Problemas con continuous mode y workarounds
- [Chromium HTML5 group - 60 second limit](https://groups.google.com/a/chromium.org/g/chromium-html5/c/s2XhT-Y5qAc) — Limite de sesion de ~60s

### Tertiary (LOW confidence)
- Rate-limiting behavior en reinicios rapidos — documentado en foros pero no en docs oficiales. Validar empiricamente.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — APIs nativas bien documentadas, no hay librerias externas
- Architecture: HIGH — Patrones canonicos de MDN y Chrome Dev Blog
- Pitfalls: MEDIUM — El conflicto Android es reportado en foros pero no documentado oficialmente; el rate-limiting es anecdotico

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (APIs estables, cambian lentamente)
