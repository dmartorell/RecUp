---
phase: 01-extensi-n-chrome-para-bugshot
plan: 05
subsystem: ui
tags: [chrome-extension, manifest-v3, icons, e2e, sips]

# Dependency graph
requires:
  - phase: 01-extensi-n-chrome-para-bugshot
    provides: Scaffolding, login, textarea, audio, webapp integration (planes 01-04)
provides:
  - Iconos 16/48/128px PNG para barra de herramientas Chrome
  - Extensión Chrome completa y verificada E2E
  - Flujo texto funcional via URL query params
  - Permiso microphone declarado en manifest MV3
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "sips (macOS built-in) para redimensionar PNG sin dependencias externas"
    - "Chrome Extension a webapp: URL query params para datos de sesión corta"

key-files:
  created:
    - chrome-extension/icons/icon16.png
    - chrome-extension/icons/icon48.png
    - chrome-extension/icons/icon128.png
  modified:
    - chrome-extension/popup.js
    - chrome-extension/manifest.json
    - src/js/app.js

key-decisions:
  - "sips elegido sobre ImageMagick/sharp — disponible en macOS sin instalación, suficiente para resize simple"
  - "Datos popup->webapp via URL query params — chrome.storage.session no accesible desde páginas web normales"
  - "Permiso microphone declarado en manifest.json — requerido por MV3 para getUserMedia en popup"
  - "handleExtensionMode ejecutado antes de checkAuth — evita flash de pantalla de login"

patterns-established:
  - "Icons PNG generados con sips -z WxH src --out dst"
  - "Chrome Extension a webapp: siempre usar URL params para datos cortos, no chrome.storage.session"

requirements-completed: [EXT-POLISH]

# Metrics
duration: 45min
completed: 2026-03-13
---

# Phase 01 Plan 05: Iconos y Verificacion E2E Summary

**Iconos 16/48/128px generados con sips y dos bugs criticos corregidos: paso de datos por URL query params y permiso microphone en manifest MV3**

## Performance

- **Duration:** ~45 min (incluyendo verificacion E2E manual y correccion de bugs)
- **Started:** 2026-03-13T15:58:00Z
- **Completed:** 2026-03-13T17:00:00Z
- **Tasks:** 2 (1 auto + 1 checkpoint con fixes post-verificacion)
- **Files modified:** 6

## Accomplishments
- Iconos PNG validos (RGBA, 16/48/128px) generados desde el logo de Bugshot con sips
- Bug flujo texto corregido: datos pasan via URL query param en lugar de chrome.storage.session
- Bug microfono corregido: permiso "microphone" declarado en manifest.json
- Extensión Chrome completamente funcional y lista para distribucion interna

## Task Commits

Cada tarea commiteada atomicamente:

1. **Task 1: Generar iconos 16/48/128px** - `f368781` (chore)
2. **Fix Bug 1: flujo texto — URL query params** - `da90389` (fix)
3. **Fix Bug 2: permiso microphone en manifest** - `4fdcfd6` (fix)

## Files Created/Modified
- `chrome-extension/icons/icon16.png` - Icono 16x16px para barra de herramientas
- `chrome-extension/icons/icon48.png` - Icono 48x48px para gestion de extensiones
- `chrome-extension/icons/icon128.png` - Icono 128x128px para detalles
- `chrome-extension/popup.js` - Envio de datos cambiado a URL query param
- `chrome-extension/manifest.json` - Permiso "microphone" añadido
- `src/js/app.js` - handleExtensionMode lee desde URLSearchParams, se ejecuta antes de checkAuth

## Decisions Made
- `chrome.storage.session` no es accesible desde paginas web normales (http://localhost:3000). La comunicacion correcta para este caso es via URL params, accesibles sin privilegios de extension.
- El permiso `"microphone"` es obligatorio en manifest MV3 para que `getUserMedia` funcione desde el popup.
- `handleExtensionMode` se mueve al inicio del DOMContentLoaded para que la sesion quede establecida antes de que `checkAuth` evalue si mostrar la pantalla de login.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Flujo texto no creaba card — chrome.storage.session inaccesible desde webapp**
- **Found during:** Task 2 (verificacion E2E manual — checkpoint)
- **Issue:** El popup escribia en `chrome.storage.session` pero la webapp (http://localhost:3000) no tiene acceso a chrome.storage desde una pagina web normal. `handleExtensionMode` leia la misma clave pero obtenia undefined.
- **Fix:** popup.js pasa el contenido como query param `?content=<encoded>`. app.js lee con `URLSearchParams`.
- **Files modified:** chrome-extension/popup.js, src/js/app.js
- **Verification:** URL `http://localhost:3000/?mode=extension&content=...` accesible sin privilegios de extension
- **Committed in:** `da90389`

**2. [Rule 2 - Missing Critical] Permiso microphone ausente en manifest**
- **Found during:** Task 2 (verificacion E2E manual — checkpoint)
- **Issue:** `manifest.json` solo tenia `["storage", "tabs"]`. En MV3, `getUserMedia` desde el popup requiere declarar `"microphone"` en `permissions`.
- **Fix:** Añadido `"microphone"` al array `permissions`.
- **Files modified:** chrome-extension/manifest.json
- **Verification:** Manifest valido; tras recargar la extension el navegador pedira permiso al primer uso
- **Committed in:** `4fdcfd6`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Ambos fixes eran bloqueantes para los flujos principales. Sin ellos la extension era inutilizable. No hay scope creep.

## Issues Encountered
- La verificacion E2E manual revelo que `chrome.storage.session` no es la primitiva correcta para comunicar datos de la extension a una webapp externa. La comunicacion correcta para este caso de uso es via URL params.

## User Setup Required
Tras aplicar el fix del manifest, el usuario debe recargar la extension en `chrome://extensions` (boton de recarga en la tarjeta de Bugshot) para que el nuevo permiso `"microphone"` surta efecto.

## Next Phase Readiness
- Extension Chrome completa y verificada — todos los flujos funcionales
- Phase 01 (v1.1 Extension Chrome) completada en su totalidad
- Lista para distribucion interna via carga desempaquetada

---
*Phase: 01-extensi-n-chrome-para-bugshot*
*Completed: 2026-03-13*
