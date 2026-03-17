---
phase: quick-14
plan: 14
subsystem: extension-webapp-communication
tags: [chrome-extension, postMessage, scripting, MV3]
dependency_graph:
  requires: []
  provides: [postMessage-channel-extension-webapp]
  affects: [chrome-extension/popup.js, chrome-extension/background.js, src/js/app.js]
tech_stack:
  added: [chrome.scripting.executeScript, window.postMessage]
  patterns: [executeScript-postMessage-bridge, message-type-discriminator]
key_files:
  modified:
    - src/js/app.js
    - chrome-extension/popup.js
    - chrome-extension/background.js
    - chrome-extension/manifest.json
decisions:
  - chrome.scripting.executeScript used to inject postMessage into tab (MV3 tabs have no content script)
  - No origin validation on postMessage receiver (type field 'recup:extension-data' as discriminator)
  - URL params fallback preserved for new tab case (no tab open)
metrics:
  duration: ~10min
  completed: "2026-03-17T10:44:00Z"
  tasks_completed: 2
  files_modified: 4
---

# Phase quick-14: postMessage extension→webapp communication

**One-liner:** Extensión usa `chrome.scripting.executeScript` para inyectar `window.postMessage` en tab existente de RecUp, evitando recarga de página al enviar incidents o texto desde popup/context menu.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Webapp escucha mensajes postMessage de la extensión | 0e0e15f | src/js/app.js |
| 2 | Extensión usa postMessage si tab existe, URL params si tab nueva | 1e0fcd5 | chrome-extension/popup.js, background.js, manifest.json |

## Decisions Made

- **executeScript como puente postMessage:** En MV3, una tab con una página web normal no tiene content script inyectado, por lo que `chrome.tabs.sendMessage` no funciona. `chrome.scripting.executeScript` con `func: (msg) => window.postMessage(msg, '*')` es la solución correcta.
- **Sin validación de origen en postMessage:** El campo `type: 'recup:extension-data'` actúa como discriminador suficiente para una herramienta interna. No se valida `event.origin` ni `chrome.runtime` ID.
- **URL params solo para tab nueva:** El fallback original se conserva intacto — si no hay tab abierta, se crea con URL params como antes.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check

- [x] `src/js/app.js` modified — handlePostMessage function added
- [x] `chrome-extension/popup.js` modified — executeScript path for existing tab
- [x] `chrome-extension/background.js` modified — same pattern for context menu
- [x] `chrome-extension/manifest.json` modified — "scripting" permission added
- [x] Commit 0e0e15f exists
- [x] Commit 1e0fcd5 exists

## Self-Check: PASSED
