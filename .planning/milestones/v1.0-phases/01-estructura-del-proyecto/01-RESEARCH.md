# Phase 1: Estructura del Proyecto - Research

**Researched:** 2026-03-07
**Domain:** Express server + static frontend + Tailwind CDN + browser feature detection
**Confidence:** HIGH

## Summary

Esta fase establece la base del proyecto: un servidor Express que sirve archivos estaticos (HTML/JS/CSS), con Tailwind CSS v4 via CDN para estilos, deteccion de navegador Chromium, y el layout visual tipo feed inspirado en "How I AI" de Anthropic.

El stack es sencillo y bien documentado. Express 5.x es la version actual (default en npm), Tailwind v4 CDN usa `@tailwindcss/browser@4` con configuracion CSS-first via `@theme`, y la deteccion de Chromium se hace con feature detection de `webkitSpeechRecognition`.

**Recomendacion principal:** Express 5 + Tailwind v4 CDN + ES Modules + dotenv. Feature detection basada en APIs requeridas (SpeechRecognition), no en user-agent sniffing.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Estilo visual: Light clean, fondo claro (#ffffff/#f5f5f5), cards blancas con sombra sutil
- Tipografia: Inter (Google Fonts)
- Color de acento: azul #2563eb
- Bordes redondeados 8-12px
- CSS: Tailwind CDN (sin build step)
- Patron feed tipo "How I AI": cards apiladas en columna centrada, max-width ~700px
- Botones de accion (video + audio) flotantes en la parte inferior
- Responsive: desktop + movil
- Header: solo nombre "BugShot", minimalista
- Empty state: icono centrado + texto invitando a grabar
- Mensaje de compatibilidad: pagina bloqueante si no es Chromium
- Estructura: server/ y src/ separados, ES Modules, puerto 3000, nodemon
- Flujo automatico: grabar -> transcribir -> resumir -> card con bullets

### Claude's Discretion
- Espaciado y tamanos exactos de tipografia
- Diseno del loading skeleton / spinner durante procesamiento
- Animaciones de transicion entre estados de card
- Estructura interna de los archivos JS (modulos, clases, etc)
- Icono exacto del empty state

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ESTR-01 | Proyecto Express sirve HTML/JS/CSS estatico con .env para credenciales | Express 5.x + express.static + dotenv con ES Modules |
| ESTR-02 | Feature detection avisa si el navegador no es compatible (Chromium requerido) | Deteccion de webkitSpeechRecognition + MediaRecorder, pantalla bloqueante |
| ESTR-03 | UI single-page con CSS moderno y estilo profesional | Tailwind v4 CDN + Inter font + layout feed centrado |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | 5.x (5.2.1) | Servidor HTTP + static files | Default en npm, LTS, API estable |
| dotenv | 16.x | Cargar variables de .env | Estandar de facto para env vars en Node |
| nodemon | 3.x (3.1.14) | Auto-restart en desarrollo | Estandar para dev workflow en Node |

### Frontend (CDN, sin instalacion)
| Library | Version | Purpose | Carga |
|---------|---------|---------|-------|
| Tailwind CSS | v4 (browser) | Utility-first CSS | `<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>` |
| Inter font | - | Tipografia principal | Google Fonts link |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tailwind CDN | CSS vanilla | Mas control pero mas lento de prototipar, usuario decidio Tailwind |
| Express 5 | Express 4 | v4 aun funciona pero v5 es default, mejor usar lo actual |
| dotenv | Node --env-file flag | Node 20.6+ soporta --env-file, pero dotenv es mas portable y explicito |

**Installation:**
```bash
npm init -y
npm install express dotenv
npm install --save-dev nodemon
```

## Architecture Patterns

### Estructura de carpetas (decidida por el usuario)
```
bugshot/
├── server/
│   ├── index.js          # Entry point, Express config, static middleware
│   └── routes/           # API endpoints (vacio en Phase 1, preparado)
├── src/
│   ├── index.html        # Single page
│   ├── js/
│   │   └── app.js        # Logica principal
│   └── css/
│       └── styles.css    # Estilos custom (complementa Tailwind)
├── .env                  # Credenciales (ClickUp API key, etc)
├── .env.example          # Template sin valores reales
├── .gitignore            # node_modules, .env
└── package.json          # type: module, scripts
```

### Pattern 1: Express Static Server con ES Modules
**What:** Entry point que carga dotenv, configura Express y sirve src/ como directorio estatico.
**When to use:** Siempre en este proyecto.
**Example:**
```javascript
// server/index.js
import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(join(__dirname, '..', 'src')));

app.listen(PORT, () => {
  console.log(`BugShot running on http://localhost:${PORT}`);
});
```

### Pattern 2: Feature Detection bloqueante
**What:** Script que detecta APIs requeridas antes de mostrar la app.
**When to use:** Al cargar la pagina, antes de cualquier logica.
**Example:**
```javascript
function isBrowserCompatible() {
  const hasSpeechRecognition = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
  const hasGetUserMedia = !!navigator.mediaDevices?.getUserMedia;
  return hasSpeechRecognition && hasMediaRecorder && hasGetUserMedia;
}

if (!isBrowserCompatible()) {
  document.getElementById('app').style.display = 'none';
  document.getElementById('unsupported').style.display = 'flex';
}
```

### Pattern 3: Tailwind v4 CDN con tema custom
**What:** Configurar colores custom del proyecto via @theme en un style tag.
**Example:**
```html
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
<style type="text/tailwindcss">
  @theme {
    --color-accent: #2563eb;
    --color-accent-hover: #1d4ed8;
    --font-sans: 'Inter', sans-serif;
  }
</style>
```
Esto permite usar `bg-accent`, `text-accent`, etc. en las clases HTML.

### Pattern 4: Google Fonts Inter
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Anti-Patterns to Avoid
- **User-agent sniffing para deteccion de navegador:** Fragil y poco fiable. Usar feature detection de las APIs reales (SpeechRecognition, MediaRecorder).
- **Tailwind CDN en produccion real:** Aceptable para herramienta interna, pero genera CSS en runtime. Para este proyecto es correcto segun decision del usuario.
- **`import dotenv` + `dotenv.config()` con ES Modules:** Usar `import 'dotenv/config'` directamente, que auto-ejecuta config().

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Variables de entorno | Parser propio de .env | dotenv | Edge cases con comillas, multiline, encoding |
| CSS utilities | Sistema de clases CSS propio | Tailwind CDN | Miles de utilities probadas, responsive built-in |
| Static file serving | Lectura manual de archivos con fs | express.static() | Manejo de MIME types, caching, security headers |
| __dirname en ESM | Hardcodear paths | fileURLToPath(import.meta.url) + dirname() | ESM no tiene __dirname, este es el patron estandar |

## Common Pitfalls

### Pitfall 1: __dirname no existe en ES Modules
**What goes wrong:** `ReferenceError: __dirname is not defined` al usar `type: "module"`.
**Why it happens:** ES Modules no inyectan __dirname ni __filename.
**How to avoid:** Usar el patron `fileURLToPath(import.meta.url)` + `dirname()`.

### Pitfall 2: dotenv no carga antes de usar process.env
**What goes wrong:** Variables de entorno undefined.
**Why it happens:** Con ES Modules, el orden de imports importa. Si importas modulos que usan process.env antes de dotenv, los valores no estan.
**How to avoid:** `import 'dotenv/config'` como primera linea del entry point.

### Pitfall 3: Tailwind v4 CDN syntax diferente de v3
**What goes wrong:** Intentar usar `tailwind.config` o `@apply` con la CDN v4.
**Why it happens:** Tailwind v4 usa CSS-first config con `@theme`, no JavaScript config.
**How to avoid:** Usar `<style type="text/tailwindcss">` con `@theme {}` para customizacion. `@apply` no disponible en CDN.

### Pitfall 4: express.static path relativo
**What goes wrong:** Archivos no encontrados (404) dependiendo de desde donde se ejecuta `node`.
**Why it happens:** Paths relativos se resuelven desde el CWD, no desde el archivo.
**How to avoid:** Siempre usar path absoluto con `join(__dirname, '..', 'src')`.

### Pitfall 5: Tailwind v4 browser compatibility
**What goes wrong:** Estilos no aplicados en navegadores antiguos.
**Why it happens:** Tailwind v4 requiere Safari 16.4+, Chrome 111+, Firefox 128+.
**How to avoid:** No es problema para este proyecto (ya requiere Chromium moderno). Pero el mensaje de "navegador no compatible" debe mostrarse SIN depender de Tailwind (CSS inline o minimal stylesheet).

## Code Examples

### package.json base
```json
{
  "name": "bugshot",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server/index.js",
    "dev": "nodemon server/index.js"
  }
}
```

### .gitignore
```
node_modules/
.env
```

### .env.example
```
PORT=3000
CLICKUP_API_KEY=
CLICKUP_LIST_ID=901507966221
CLAUDE_API_KEY=
```

### Pantalla de navegador no compatible (sin Tailwind)
```html
<div id="unsupported" style="display:none; position:fixed; inset:0; background:#fff; z-index:9999; display:flex; align-items:center; justify-content:center; flex-direction:column; font-family:Inter,sans-serif; padding:2rem; text-align:center;">
  <h1 style="font-size:1.5rem; font-weight:600; margin-bottom:1rem;">Navegador no compatible</h1>
  <p style="color:#666; max-width:400px; margin-bottom:1.5rem;">
    BugShot necesita APIs que solo estan disponibles en navegadores basados en Chromium.
    Por favor, usa Chrome o Edge.
  </p>
  <a href="https://www.google.com/chrome/" style="background:#2563eb; color:#fff; padding:0.75rem 1.5rem; border-radius:8px; text-decoration:none; font-weight:500;">
    Descargar Chrome
  </a>
</div>
```
**Nota:** Esta pantalla usa CSS inline porque si el navegador no es compatible, Tailwind v4 CDN podria no funcionar tampoco.

### Layout base del feed
```html
<div id="app" class="min-h-screen bg-gray-50">
  <header class="border-b border-gray-200 bg-white">
    <div class="mx-auto max-w-3xl px-4 py-4">
      <h1 class="text-xl font-semibold text-gray-900">BugShot</h1>
    </div>
  </header>

  <main class="mx-auto max-w-3xl px-4 py-8">
    <!-- Empty state (visible cuando no hay grabaciones) -->
    <div id="empty-state" class="flex flex-col items-center justify-center py-24 text-center">
      <div class="mb-4 text-6xl text-gray-300">🎙️</div>
      <h2 class="text-lg font-medium text-gray-600">No hay grabaciones</h2>
      <p class="mt-1 text-sm text-gray-400">Pulsa un boton para empezar a grabar</p>
    </div>

    <!-- Feed de cards (se puebla dinamicamente) -->
    <div id="feed" class="space-y-4"></div>
  </main>

  <!-- Botones flotantes -->
  <div class="fixed bottom-6 left-1/2 flex -translate-x-1/2 gap-3">
    <button class="rounded-full bg-accent px-6 py-3 font-medium text-white shadow-lg">
      Audio
    </button>
    <button class="rounded-full bg-accent px-6 py-3 font-medium text-white shadow-lg">
      Video
    </button>
  </div>
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Express 4 | Express 5 (default npm) | Mar 2025 | Mejor async errors, req.query inmutable |
| Tailwind v3 CDN (`cdn.tailwindcss.com`) | Tailwind v4 (`@tailwindcss/browser@4`) | Ene 2025 | CSS-first config, @theme en vez de JS config |
| CommonJS (require) | ES Modules (import) | Node 14+ | type: module en package.json, sin __dirname |
| tailwind.config.js | @theme {} en CSS | Tailwind v4 | Configuracion directa en CSS |

## Open Questions

1. **Emoji vs SVG para empty state icon**
   - What we know: El usuario dijo icono centrado + texto, dejo el icono exacto a discrecion
   - Recommendation: Usar emoji (ej: microfono) para v1, simple y sin dependencias. Si se quiere mas polish, usar un SVG inline de Heroicons

## Sources

### Primary (HIGH confidence)
- [Express npm](https://www.npmjs.com/package/express) - Version 5.2.1 confirmed
- [Express static files docs](https://expressjs.com/en/starter/static-files.html) - express.static API
- [Tailwind v4 Play CDN](https://tailwindcss.com/docs/installation/play-cdn) - CDN setup + @theme config
- [Inter - Google Fonts](https://fonts.google.com/specimen/Inter) - Font import
- [nodemon npm](https://www.npmjs.com/package/nodemon) - Version 3.1.14

### Secondary (MEDIUM confidence)
- [dotenv npm](https://www.npmjs.com/package/dotenv) - ES Modules usage pattern
- [Can I use - Speech Recognition](https://caniuse.com/speech-recognition) - Browser support matrix

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Todas son librerias maduras y bien documentadas
- Architecture: HIGH - Patron Express + static es trivial y ampliamente usado
- Pitfalls: HIGH - Bien documentados, especialmente ESM + dotenv + Tailwind v4

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stack estable, sin cambios esperados)
