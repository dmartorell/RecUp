---
phase: quick-13
plan: "01"
subsystem: testing
tags: [testing, bun-test, integration-tests, backend]
dependency_graph:
  requires: [server/app.js, server/routes/*, server/middleware/*, server/services/*]
  provides: [tests/auth.test.js, tests/incidents.test.js, tests/routes-proxy.test.js]
  affects: [server/app.js, server/index.js]
tech_stack:
  added: [bunfig.toml, bun:test nativo]
  patterns: [preload pattern para env vars, mock de global.fetch, mock de metodos de servicio]
key_files:
  created:
    - server/app.js
    - tests/setup.js
    - tests/preload.js
    - tests/auth.test.js
    - tests/incidents.test.js
    - tests/routes-proxy.test.js
    - bunfig.toml
  modified:
    - server/index.js
decisions:
  - preload.js via bunfig.toml para setear env vars antes de cargar modulos ES cacheados
  - originalFetch para peticiones del test al servidor local, global.fetch mock solo para APIs externas
  - Mock de ClickUpService.resolveEmailToUserId en lugar de mock del endpoint /team para evitar problema de cache de modulo
  - Tests usan la DB real (data/recup.db) con cleanDb() en beforeAll/afterAll — aceptable para herramienta interna
metrics:
  duration: "~15 min"
  completed_date: "2026-03-16"
  tasks_completed: 3
  files_created: 7
  files_modified: 1
---

# Quick Task 13: Tests de integración backend Summary

**One-liner:** Suite de 27 tests de integración con bun:test nativo — auth, incidents CRUD y rutas proxy con mocks de fetch.

## Tasks Completadas

| Task | Nombre | Commit | Archivos |
|------|--------|--------|----------|
| 1 | Crear app.js exportable y test helpers | acc6c6f | server/app.js, server/index.js, tests/setup.js, tests/preload.js, bunfig.toml |
| 2 | Tests de integración auth + incidents | 22bb40d | tests/auth.test.js, tests/incidents.test.js |
| 3 | Tests de integración rutas proxy | 3d6b0da | tests/routes-proxy.test.js |

## Resultado Final

```
bun test
27 pass, 0 fail
Ran 27 tests across 3 files.
```

- **auth.test.js**: 9 tests — register (5 casos) + login (4 casos)
- **incidents.test.js**: 8 tests — auth guard + CRUD completo + ownership enforcement
- **routes-proxy.test.js**: 10 tests — summarize (4), ticket (3), attachment (3)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] bunfig.toml con preload para env vars**
- **Found during:** Task 1 verification
- **Issue:** `dotenv/config` en env.js carga el `.env` de producción (incluye `ALLOWED_EMAIL_DOMAIN`, `CLICKUP_*`) sobrescribiendo las vars de test si no se setean ANTES de que cualquier módulo ES se cargue
- **Fix:** `tests/preload.js` setea todas las env vars necesarias; `bunfig.toml` configura el preload para ejecutarse antes de cualquier test file
- **Files modified:** tests/preload.js, bunfig.toml

**2. [Rule 1 - Bug] Mock de fetch intercepta peticiones locales**
- **Found during:** Task 3
- **Issue:** Al hacer `global.fetch = mock(...)`, el mock interceptaba tanto las peticiones del test al servidor local como las peticiones del servidor a APIs externas, causando 401 en los tests de summarize y ticket
- **Fix:** Usar `originalFetch` guardado antes del mock para hacer las peticiones del test al servidor local; el mock solo intercepta en el interior del servidor
- **Files modified:** tests/routes-proxy.test.js

**3. [Rule 1 - Bug] Cache de módulo en ClickUpService.getWorkspaceMembers**
- **Found during:** Task 3
- **Issue:** `cachedMembers` es una variable privada del módulo, no accesible desde los tests para resetear. Al mockear la respuesta de `/team`, el cache previo (si existía) retornaba datos incorrectos
- **Fix:** Mock directo del método `ClickUpService.resolveEmailToUserId` en lugar de mockear fetch para el endpoint de teams
- **Files modified:** tests/routes-proxy.test.js

## Self-Check: PASSED

Archivos creados:
- server/app.js: FOUND
- tests/setup.js: FOUND
- tests/preload.js: FOUND
- tests/auth.test.js: FOUND
- tests/incidents.test.js: FOUND
- tests/routes-proxy.test.js: FOUND
- bunfig.toml: FOUND

Commits:
- acc6c6f: FOUND
- 22bb40d: FOUND
- 3d6b0da: FOUND

`bun test`: 27 pass, 0 fail
