# Phase 4: Tickets + Adjuntos - Research

**Researched:** 2026-03-07
**Domain:** ClickUp API integration (crear tareas + subir adjuntos) + file handling frontend
**Confidence:** HIGH

## Summary

La fase integra dos flujos: (1) crear un ticket en ClickUp con titulo/descripcion generados por Claude, y (2) adjuntar archivos multimedia al ticket creado. Ambos requieren un proxy en Express para no exponer la API key de ClickUp en el frontend.

El backend necesita dos endpoints: `/api/ticket` (JSON, crea tarea) y `/api/attachment` (multipart, sube archivos). El frontend necesita un modal con campos editables, selector de archivos con preview, y feedback de exito con enlace al ticket.

**Recomendacion principal:** Usar `fetch` nativo con `FormData` tanto en frontend como backend. Multer para parsear uploads en Express, `FormData` nativo de Node.js para reenviar a ClickUp. No se necesitan librerias adicionales aparte de multer.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TICK-01 | Endpoint /api/ticket proxy a ClickUp API para crear tareas | ClickUp API v2 `POST /list/{list_id}/task`, JSON body con `name` + `markdown_description` |
| TICK-02 | Modal con campos editables para crear el ticket | Frontend vanilla: modal HTML con campos username, projectId, assetId prellenados |
| TICK-03 | Confirmacion de exito con enlace al ticket creado | ClickUp devuelve `id` y `url` en response, mostrar toast/banner con enlace |
| ADJU-01 | Usuario puede adjuntar fotos/videos desde galeria o camara | `<input type="file" accept="image/*,video/*" capture>` + multiple |
| ADJU-02 | Preview de archivos adjuntos antes de crear el ticket | `URL.createObjectURL()` para imagenes/video, mostrar thumbnails |
| ADJU-03 | Endpoint /api/attachment sube archivos al ticket en ClickUp | ClickUp API v2 `POST /task/{task_id}/attachment`, multipart/form-data via multer + fetch |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | ^4.21.0 | Servidor proxy (ya instalado) | Ya en el proyecto |
| multer | ^1.4.5-lts.1 | Parsear multipart/form-data en Express | Estandar de facto para uploads en Express, robusto y mantenido |
| dotenv | ^16.4.0 | Variables de entorno (ya instalado) | Ya en el proyecto |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| FormData (nativo Node.js) | Built-in | Construir multipart para reenvio a ClickUp | Para el endpoint /api/attachment al hacer proxy |

### No se necesita

| Libreria | Razon para NO usarla |
|----------|---------------------|
| axios | `fetch` nativo en Bun es suficiente para llamadas HTTP |
| form-data (npm) | Node 18+ y Bun tienen `FormData` nativo |
| busboy | Multer ya lo usa internamente |
| sharp/jimp | No se procesan imagenes, solo se reenvian |

**Instalacion:**
```bash
bun add multer
```

## Architecture Patterns

### Estructura de archivos nuevos
```
server/
  index.js           # (existente) agregar rutas
  routes/
    ticket.js         # POST /api/ticket
    attachment.js      # POST /api/attachment
src/
  js/
    ticket-modal.js    # Modal UI + logica de creacion
    attachments.js     # Selector de archivos + preview
```

### Patron 1: Proxy transparente a ClickUp (crear tarea)

**Que:** El frontend envia JSON al backend, el backend agrega headers de autenticacion y reenvia a ClickUp.
**Cuando:** Para `/api/ticket`

```javascript
// server/routes/ticket.js
import { Router } from 'express';
const router = Router();

router.post('/api/ticket', async (req, res) => {
  const { name, markdown_description, priority, status } = req.body;

  const response = await fetch(
    `https://api.clickup.com/api/v2/list/${process.env.CLICKUP_LIST_ID}/task`,
    {
      method: 'POST',
      headers: {
        'Authorization': process.env.CLICKUP_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, markdown_description, priority, status }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    return res.status(response.status).json({ error: data });
  }

  res.json({ id: data.id, url: data.url });
});

export default router;
```

### Patron 2: Proxy multipart para adjuntos

**Que:** El frontend envia archivos via multipart, Express los parsea con multer (en memoria), y los reenvia a ClickUp como multipart.
**Cuando:** Para `/api/attachment`

```javascript
// server/routes/attachment.js
import { Router } from 'express';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

router.post('/api/attachment', upload.array('attachment', 10), async (req, res) => {
  const { taskId } = req.body;

  const results = [];
  for (const file of req.files) {
    const form = new FormData();
    form.append('attachment', new Blob([file.buffer], { type: file.mimetype }), file.originalname);

    const response = await fetch(
      `https://api.clickup.com/api/v2/task/${taskId}/attachment`,
      {
        method: 'POST',
        headers: { 'Authorization': process.env.CLICKUP_API_KEY },
        body: form,
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data, file: file.originalname });
    }
    results.push(data);
  }

  res.json({ attachments: results });
});

export default router;
```

### Patron 3: Preview de archivos en frontend

**Que:** Mostrar thumbnails de archivos seleccionados antes de enviar.
**Cuando:** Para ADJU-02

```javascript
// src/js/attachments.js
function createPreview(file) {
  const url = URL.createObjectURL(file);
  const isVideo = file.type.startsWith('video/');

  const el = document.createElement('div');
  el.className = 'attachment-preview';
  el.innerHTML = isVideo
    ? `<video src="${url}" class="preview-thumb"></video>`
    : `<img src="${url}" class="preview-thumb" alt="${file.name}">`;

  el.innerHTML += `<button class="preview-remove" aria-label="Quitar">&times;</button>
    <span class="preview-name">${file.name}</span>`;

  return el;
}
```

### Patron 4: Flujo secuencial crear ticket + subir adjuntos

**Que:** Primero crear el ticket, obtener el `taskId`, luego subir adjuntos uno a uno.
**Cuando:** Siempre -- ClickUp requiere un task_id existente para adjuntar archivos.

```javascript
// src/js/ticket-modal.js (frontend)
async function createTicketWithAttachments(ticketData, files) {
  // 1. Crear ticket
  const ticketRes = await fetch('/api/ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ticketData),
  });
  const ticket = await ticketRes.json();
  if (!ticketRes.ok) throw new Error(ticket.error?.err || 'Error creando ticket');

  // 2. Subir adjuntos si hay
  if (files.length > 0) {
    const form = new FormData();
    form.append('taskId', ticket.id);
    for (const file of files) {
      form.append('attachment', file);
    }
    const attachRes = await fetch('/api/attachment', { method: 'POST', body: form });
    if (!attachRes.ok) {
      const err = await attachRes.json();
      throw new Error(err.error?.err || 'Error subiendo adjuntos');
    }
  }

  return ticket;
}
```

### Anti-Patterns a Evitar

- **Enviar API key al frontend:** Nunca. Siempre proxy via Express.
- **Almacenar archivos en disco del servidor:** No. Usar `multer.memoryStorage()` y reenviar directamente.
- **Subir adjuntos antes de crear el ticket:** Imposible, ClickUp necesita el task_id primero.
- **Subir todos los archivos en paralelo:** Puede causar rate-limiting en ClickUp. Subir secuencialmente.
- **Setear Content-Type manualmente en fetch con FormData:** `fetch` lo genera automaticamente con el boundary correcto. Setearlo manualmente rompe la request.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parsear multipart uploads | Parser manual de boundaries | multer | Parsing multipart es complejo, tiene edge cases con encoding y boundaries |
| Construir multipart para reenvio | Concatenar boundaries a mano | `FormData` nativo + `Blob` | El runtime maneja encoding y boundaries correctamente |
| Preview de archivos | Leer archivos y crear base64 | `URL.createObjectURL()` | Mas eficiente, no bloquea el hilo, se libera con `revokeObjectURL` |
| Validacion MIME types | Regex sobre extension | Atributo `accept` en input + verificar `file.type` | El browser ya valida en el selector |

**Insight clave:** El flujo es proxy puro -- el servidor no procesa ni almacena nada, solo reenvia con autenticacion. Mantener esa simplicidad.

## Common Pitfalls

### Pitfall 1: Content-Type con FormData en fetch
**Que pasa:** Si seteas `Content-Type: multipart/form-data` manualmente en fetch, el boundary no se incluye y ClickUp rechaza la request.
**Por que ocurre:** `fetch` genera el header automaticamente con el boundary correcto cuando el body es `FormData`.
**Como evitar:** NUNCA setear Content-Type manualmente cuando el body es FormData. Solo setear Authorization.
**Sintomas:** Error 400 "No attachment supplied" de ClickUp.

### Pitfall 2: Blob vs Buffer en Node.js FormData
**Que pasa:** Multer devuelve `file.buffer` (Buffer). Para reenviarlo via FormData nativo de Node.js, necesitas wrapearlo en `Blob`.
**Como evitar:** `new Blob([file.buffer], { type: file.mimetype })` y pasar el filename como tercer argumento de `form.append()`.
**Sintomas:** ClickUp recibe archivo vacio o con tipo incorrecto.

### Pitfall 3: Limite de memoria con archivos grandes
**Que pasa:** `multer.memoryStorage()` carga todo el archivo en RAM. Videos largos pueden causar OOM.
**Como evitar:** Limitar `fileSize` en multer config (100MB es razonable para videos cortos). Mostrar error claro al usuario.
**Sintomas:** El proceso de Node.js se crashea sin error claro.

### Pitfall 4: ClickUp rate limiting
**Que pasa:** ClickUp limita a 100 requests por minuto por token.
**Por que ocurre:** Si se suben muchos adjuntos simultaneamente.
**Como evitar:** Subir archivos secuencialmente, no en paralelo. Para este caso de uso (pocos archivos por ticket), no deberia ser problema.
**Sintomas:** HTTP 429 de ClickUp.

### Pitfall 5: El campo `attachment` en ClickUp
**Que pasa:** ClickUp espera el campo del form como `attachment` (singular), no `file` ni `attachments`.
**Como evitar:** Verificar que el nombre del campo sea exactamente `attachment`.
**Sintomas:** Error "No attachment supplied".

### Pitfall 6: Captura de fotos en movil
**Que pasa:** El atributo `capture` en el input abre directamente la camara, pero si el usuario quiere elegir de galeria necesita un input sin `capture`.
**Como evitar:** Usar dos botones: uno con `capture="environment"` para camara y otro sin capture para galeria. O un solo input sin `capture` que en movil ofrece ambas opciones.
**Sintomas:** En movil solo se abre la camara, sin opcion de galeria.

## Code Examples

### ClickUp Create Task - Request completo

```javascript
// POST https://api.clickup.com/api/v2/list/{list_id}/task
// Headers: Authorization: {api_key}, Content-Type: application/json
// Source: https://developer.clickup.com/reference/createtask

const body = {
  name: "Bug: El boton de login no responde",
  markdown_description: "## Descripcion\n- El boton no responde al hacer click\n- Solo ocurre en Chrome movil\n\n## Pasos para reproducir\n1. Abrir la app en Chrome Android\n2. Pulsar el boton de login",
  priority: 3,  // 1=Urgent, 2=High, 3=Normal, 4=Low
  status: "to do"
};
```

### ClickUp Create Task - Response relevante

```json
{
  "id": "abc123",
  "name": "Bug: El boton de login no responde",
  "url": "https://app.clickup.com/t/abc123",
  "status": { "status": "to do" },
  "priority": { "priority": "normal" }
}
```

### ClickUp Attachment - Response relevante

```json
{
  "id": "att_xyz",
  "title": "screenshot.png",
  "url": "https://attachments.clickup.com/...",
  "extension": "png",
  "thumbnail_small": "https://...",
  "thumbnail_large": "https://..."
}
```

### Input file con preview (frontend)

```html
<input type="file" id="file-input" multiple accept="image/*,video/*">
<div id="preview-grid" class="grid grid-cols-3 gap-2"></div>
```

```javascript
document.getElementById('file-input').addEventListener('change', (e) => {
  const grid = document.getElementById('preview-grid');
  grid.innerHTML = '';
  for (const file of e.target.files) {
    const url = URL.createObjectURL(file);
    const isVideo = file.type.startsWith('video/');
    const el = document.createElement('div');
    el.className = 'relative';
    el.innerHTML = isVideo
      ? `<video src="${url}" class="w-full h-24 object-cover rounded"></video>`
      : `<img src="${url}" class="w-full h-24 object-cover rounded">`;
    grid.appendChild(el);
  }
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `form-data` npm package | `FormData` nativo en Node 18+/Bun | Node 18 (2022) | No necesitas dependencia extra |
| `request` / `node-fetch` | `fetch` nativo en Node 18+/Bun | Node 18 (2022) | No necesitas dependencia extra |
| ClickUp API v1 | ClickUp API v2 (actual) + v3 en desarrollo | 2020+ | v2 es la version estable actual |
| Multer disk storage | Multer memory storage para proxy | N/A | Evita escrituras a disco innecesarias |

**Nota:** ClickUp tiene una API v3 para adjuntos (`/v3/attachments`) pero la v2 sigue siendo la documentada y estable. Usar v2.

## Open Questions

1. **Campos custom del ticket (username, projectId, assetId)**
   - Lo que sabemos: El usuario necesita rellenar estos campos en el modal
   - Lo que no esta claro: Son campos custom de ClickUp o solo metadata en la descripcion? El contexto dice "username, projectId, assetId" pero no si son Custom Fields de ClickUp
   - Recomendacion: Incluirlos como texto en `markdown_description` del ticket. Si luego se necesitan como Custom Fields de ClickUp, es facil migrar

2. **Limite de tamano real en practica**
   - Lo que sabemos: ClickUp acepta hasta 1GB, pero subir videos grandes via proxy en memoria es problematico
   - Recomendacion: Limitar a 100MB por archivo en multer. Suficiente para fotos y videos cortos

## Sources

### Primary (HIGH confidence)
- [ClickUp API v2 - Create Task](https://developer.clickup.com/reference/createtask) - endpoint, campos, response format
- [ClickUp API v2 - Create Task Attachment](https://developer.clickup.com/reference/createtaskattachment) - endpoint, multipart format, response
- [Express Multer middleware](https://expressjs.com/en/resources/middleware/multer.html) - configuracion y API

### Secondary (MEDIUM confidence)
- [ClickUp attachment limits](https://developer.clickup.com/docs/attachments) - limite 1GB, campo `attachment`
- [FormData with fetch in Node.js](https://philna.sh/blog/2025/01/14/troubles-with-multipart-form-data-fetch-node-js/) - gotchas con CRLF (resuelto en versiones recientes)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Express + multer es el patron establecido, ClickUp API v2 esta bien documentada
- Architecture: HIGH - Proxy pattern es simple y el proyecto ya tiene la estructura base
- Pitfalls: HIGH - Los gotchas de Content-Type/FormData y el campo `attachment` estan bien documentados en la comunidad

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (APIs estables, bajo riesgo de cambios)
