---
phase: quick
plan: 3
type: execute
wave: 1
depends_on: []
files_modified:
  - src/index.html
  - src/js/ticket-modal.js
autonomous: true
must_haves:
  truths:
    - "Boton 'Hacer foto' abre visor de camara real (getUserMedia) en desktop y movil"
    - "El visor muestra video en vivo con botones Capturar y Cancelar"
    - "La foto capturada se anade como adjunto via AttachmentManager.addFiles()"
    - "Boton 'Anadir archivo' sigue funcionando igual (file picker)"
  artifacts:
    - path: "src/js/ticket-modal.js"
      provides: "Logica getUserMedia, captura canvas, UI visor camara"
    - path: "src/index.html"
      provides: "Overlay HTML para visor de camara"
  key_links:
    - from: "src/js/ticket-modal.js"
      to: "AttachmentManager.addFiles()"
      via: "canvas.toBlob -> File -> addFiles"
      pattern: "addFiles"
---

<objective>
Reemplazar el input capture="environment" por un visor de camara real usando getUserMedia. El boton "Hacer foto" abre la camara del dispositivo (webcam en desktop, camara trasera en movil), muestra un video preview con botones Capturar/Cancelar, y la foto capturada se anade como adjunto.

Purpose: La implementacion actual con capture="environment" solo funciona en movil. getUserMedia funciona en ambos.
Output: Camara funcional en desktop y movil integrada en el modal de ticket.
</objective>

<execution_context>
@/Users/danielmartorell/.claude/get-shit-done/workflows/execute-plan.md
@/Users/danielmartorell/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/index.html
@src/js/ticket-modal.js
@src/js/attachments.js

<interfaces>
From src/js/attachments.js:
```javascript
export class AttachmentManager {
  addFiles(fileList)    // Accepts FileList or array-like. Returns error string or null.
  getFiles()            // Returns File[]
  getCount()            // Returns number
  removeFile(index)     // Removes file at index
  clear()               // Clears all files and revokes objectURLs
  render()              // Re-renders preview grid
}
// MAX_FILES = 5, MAX_SIZE_BYTES = 10MB, ALLOWED_TYPES = ['image/', 'video/']
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Anadir overlay HTML de visor de camara y reemplazar input camera</name>
  <files>src/index.html</files>
  <action>
1. Eliminar el input `#attach-camera-input` (linea 124: `<input type="file" id="attach-camera-input" ...>`). Ya no se necesita.

2. Anadir un overlay de camara ANTES del cierre de `</body>`, despues de `#ticket-modal`. HTML:

```html
<div id="camera-overlay" class="hidden fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center">
  <video id="camera-viewfinder" autoplay playsinline class="max-w-full max-h-[70vh] rounded-lg"></video>
  <canvas id="camera-canvas" class="hidden"></canvas>
  <div class="flex gap-4 mt-6">
    <button id="camera-cancel-btn" type="button" class="px-6 py-3 text-white border border-white/30 rounded-full text-sm font-medium cursor-pointer hover:bg-white/10">Cancelar</button>
    <button id="camera-capture-btn" type="button" class="px-6 py-3 bg-white text-black rounded-full text-sm font-medium cursor-pointer hover:bg-gray-200">Capturar</button>
  </div>
</div>
```

Notas:
- z-[60] para estar encima del modal (z-50)
- `playsinline` es critico para iOS (evita fullscreen automatico)
- Canvas oculto se usa para capturar el frame
  </action>
  <verify>
    <automated>grep -q 'camera-overlay' src/index.html && grep -q 'camera-viewfinder' src/index.html && ! grep -q 'attach-camera-input' src/index.html && echo "OK"</automated>
  </verify>
  <done>Overlay de camara en HTML, input camera eliminado</done>
</task>

<task type="auto">
  <name>Task 2: Implementar logica getUserMedia con captura y cleanup</name>
  <files>src/js/ticket-modal.js</files>
  <action>
1. Eliminar referencias al antiguo cameraInput:
   - Quitar `const cameraInput = document.getElementById('attach-camera-input');`
   - Quitar el event listener `cameraInput.addEventListener('change', ...)`
   - Quitar `attachCameraBtn.addEventListener('click', () => cameraInput.click());`

2. Anadir referencias a los nuevos elementos del overlay de camara:
```javascript
const cameraOverlay = document.getElementById('camera-overlay');
const cameraViewfinder = document.getElementById('camera-viewfinder');
const cameraCanvas = document.getElementById('camera-canvas');
const cameraCaptureBtn = document.getElementById('camera-capture-btn');
const cameraCancelBtn = document.getElementById('camera-cancel-btn');
let cameraStream = null;
```

3. Funcion para abrir la camara:
```javascript
async function openCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
    });
    cameraViewfinder.srcObject = cameraStream;
    cameraOverlay.classList.remove('hidden');
  } catch (err) {
    showAttachmentError('No se pudo acceder a la camara.');
  }
}
```
- `facingMode: 'environment'` usa camara trasera en movil, en desktop usa la unica disponible (webcam)
- Resolucion ideal 1920x1080 para fotos de calidad

4. Funcion para cerrar la camara (cleanup obligatorio):
```javascript
function closeCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  cameraViewfinder.srcObject = null;
  cameraOverlay.classList.add('hidden');
}
```

5. Funcion para capturar foto:
```javascript
function capturePhoto() {
  const video = cameraViewfinder;
  cameraCanvas.width = video.videoWidth;
  cameraCanvas.height = video.videoHeight;
  const ctx = cameraCanvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  cameraCanvas.toBlob((blob) => {
    if (!blob) {
      showAttachmentError('Error al capturar la foto.');
      closeCamera();
      return;
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = new File([blob], `foto-${timestamp}.jpg`, { type: 'image/jpeg' });
    const err = attachments.addFiles([file]);
    if (err) showAttachmentError(err);
    closeCamera();
  }, 'image/jpeg', 0.92);
}
```
- Calidad JPEG 0.92 (buen balance tamano/calidad)
- Nombre con timestamp para evitar colisiones
- Usa `attachments` (la instancia de AttachmentManager ya existente en el modulo)

6. Event listeners:
```javascript
attachCameraBtn.addEventListener('click', openCamera);
cameraCaptureBtn.addEventListener('click', capturePhoto);
cameraCancelBtn.addEventListener('click', closeCamera);
```

7. En la funcion `closeModal()`, anadir llamada a `closeCamera()` al principio para limpiar si se cierra el modal con la camara abierta.
  </action>
  <verify>
    <automated>grep -q 'getUserMedia' src/js/ticket-modal.js && grep -q 'closeCamera' src/js/ticket-modal.js && grep -q 'capturePhoto' src/js/ticket-modal.js && ! grep -q 'attach-camera-input' src/js/ticket-modal.js && echo "OK"</automated>
  </verify>
  <done>
- "Hacer foto" abre visor de camara con getUserMedia (desktop y movil)
- Boton Capturar toma foto via canvas y la anade como adjunto
- Boton Cancelar cierra la camara y limpia el stream
- Stream se limpia tambien al cerrar el modal
- "Anadir archivo" sigue funcionando igual
  </done>
</task>

</tasks>

<verification>
1. Abrir la app en Chrome desktop, abrir modal de ticket
2. Click "Hacer foto" -> debe abrir visor con webcam del portatil
3. Click "Capturar" -> foto aparece en previews de adjuntos
4. Click "Hacer foto" de nuevo -> Click "Cancelar" -> visor se cierra, sin adjunto nuevo
5. "Anadir archivo" sigue abriendo el file picker normal
6. Probar en movil (Chrome Android/iOS) -> debe usar camara del dispositivo
</verification>

<success_criteria>
- getUserMedia abre camara real en desktop y movil
- Foto capturada aparece como adjunto con preview
- Stream se limpia correctamente (no queda LED de camara encendido)
- File picker de "Anadir archivo" no se ve afectado
</success_criteria>

<output>
After completion, create `.planning/quick/3-hacer-foto-abre-camara-real-con-getuserm/3-SUMMARY.md`
</output>
