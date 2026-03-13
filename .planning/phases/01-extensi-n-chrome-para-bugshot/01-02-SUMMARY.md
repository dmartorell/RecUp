---
phase: 01-extensi-n-chrome-para-bugshot
plan: "02"
subsystem: ui
tags: [chrome-extension, popup, chrome-storage-session, tabs]

requires:
  - phase: 01-extensi-n-chrome-para-bugshot
    plan: "01"
    provides: Vista login y vista idle básica con header (email + logout)

provides:
  - Textarea con placeholder en vista Idle del popup
  - Botón Enviar deshabilitado cuando textarea vacío, habilitado al escribir
  - Flujo completo envío de texto: chrome.storage.session + chrome.tabs.create + window.close

affects:
  - 01-04 (webapp consume bugshot_content de session storage)
  - 01-03 (comparte vista Idle, se añadirá botón mic)

tech-stack:
  added: []
  patterns:
    - "chrome.storage.session para pasar datos entre extensión y webapp"
    - "Clase .btn-send separada de .btn-primary para no heredar width:100%"

key-files:
  created: []
  modified:
    - chrome-extension/popup.html
    - chrome-extension/popup.js
    - chrome-extension/popup.css

key-decisions:
  - "Clase .btn-send en lugar de .btn-primary para el botón Enviar — .btn-primary ya tiene width:100% y se usa en login"
  - "Lectura de bugshot_token desde chrome.storage.local al enviar, con fallback 'local'"

patterns-established:
  - "Limpiar textarea y deshabilitar botón en showIdle() garantiza estado inicial limpio"
  - "chrome.storage.session.set con callback antes de abrir pestaña — evita race condition"

requirements-completed: [EXT-TEXT-INPUT]

duration: 5min
completed: 2026-03-13
---

# Phase 1 Plan 02: Input de Texto en Vista Idle Summary

**Textarea funcional en popup Idle con flujo texto → chrome.storage.session → nueva pestaña webapp → cierre popup**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-13T16:00:00Z
- **Completed:** 2026-03-13T16:05:00Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- Textarea con placeholder "Describe el issue…" integrada en #view-idle
- Botón "Enviar →" deshabilitado por defecto, se habilita al escribir contenido no vacío
- Al enviar: guarda `bugshot_content` y `bugshot_token` en `chrome.storage.session`, abre `http://localhost:3000/?mode=extension` en nueva pestaña y cierra el popup

## Task Commits

Cada task fue commiteada atómicamente:

1. **Task 1: Añadir textarea y botón Enviar a la vista Idle** - `394ba08` (feat)

**Plan metadata:** pendiente (docs: complete plan)

## Files Created/Modified
- `chrome-extension/popup.html` - Añadido `<textarea id="issue-text">` y `<button id="send-btn">` dentro de .idle-body
- `chrome-extension/popup.js` - BUGSHOT_URL, refs a issueText/sendBtn, lógica input + click, chrome.storage.session.set
- `chrome-extension/popup.css` - Estilos #issue-text, .idle-actions, .btn-send con estado :disabled

## Decisions Made
- Clase `.btn-send` en lugar de reusar `.btn-primary` para el botón Enviar — `.btn-primary` ya tiene `width: 100%` usado en login; crear clase separada evita override y mantiene coherencia visual
- Lectura de `bugshot_token` desde `chrome.storage.local` al hacer clic en Enviar, con fallback `'local'` para robustez

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Clase .btn-send en lugar de .btn-primary para el botón Enviar**
- **Found during:** Task 1
- **Issue:** El plan indica `class="btn-primary"` para el botón Enviar, pero `.btn-primary` ya existe en CSS con `width: 100%` (para el botón de login). Aplicarlo al botón Enviar lo haría de ancho completo, rompiendo el layout alineado a la derecha.
- **Fix:** Se usa clase `.btn-send` con los mismos estilos visuales pero sin `width: 100%`
- **Files modified:** chrome-extension/popup.html, chrome-extension/popup.css
- **Verification:** Layout correcto — botón alineado a la derecha dentro de .idle-actions
- **Committed in:** 394ba08

---

**Total deviations:** 1 auto-fixed (1 bug de colisión CSS)
**Impact on plan:** Fix necesario para correctness visual. Sin scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Vista Idle con textarea completa y funcional
- Plan 03 puede añadir el botón mic sin conflictos (la estructura .idle-body está lista)
- Plan 04 (webapp) puede consumir `bugshot_content` de `chrome.storage.session` tal como se definió en la interfaz

---
*Phase: 01-extensi-n-chrome-para-bugshot*
*Completed: 2026-03-13*
