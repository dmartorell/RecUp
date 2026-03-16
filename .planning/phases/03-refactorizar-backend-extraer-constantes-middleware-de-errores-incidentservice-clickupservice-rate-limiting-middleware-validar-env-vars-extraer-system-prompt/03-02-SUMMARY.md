---
phase: 03-refactorizar-backend
plan: "02"
subsystem: backend-middleware
tags: [error-handler, rate-limiter, incident-service, refactor]
dependency_graph:
  requires: ["03-01"]
  provides: ["errorHandler", "createRateLimiter", "IncidentService"]
  affects: ["server/routes/incidents.js", "server/routes/auth.js", "server/middleware/auth.js", "server/index.js"]
tech_stack:
  added: []
  patterns: ["global-error-handler", "factory-middleware", "service-layer"]
key_files:
  created:
    - server/middleware/errorHandler.js
    - server/middleware/rateLimiter.js
    - server/services/IncidentService.js
  modified:
    - server/routes/auth.js
    - server/middleware/auth.js
    - server/routes/incidents.js
    - server/index.js
decisions:
  - "assertOwnership throws Error with status/code props — caught by global errorHandler, no inline 403 in routes"
  - "createRateLimiter factory pattern — caller gets isolated state per usage"
metrics:
  duration: ~5min
  completed: "2026-03-16T17:55:16Z"
  tasks_completed: 2
  files_modified: 7
---

# Phase 03 Plan 02: Error Handler, Rate Limiter, IncidentService Summary

Global error handler + reusable rate limiter middleware + IncidentService service layer with full CRUD and ownership check.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create errorHandler, rateLimiter, update auth.js/auth middleware/index.js | 2c698af | errorHandler.js, rateLimiter.js, routes/auth.js, middleware/auth.js, index.js |
| 2 | Create IncidentService and refactor incidents.js | 6f9d829 | services/IncidentService.js, routes/incidents.js |

## Decisions Made

- `assertOwnership` throws an Error with `status` and `code` properties — caught by `errorHandler`, keeps routes thin
- `createRateLimiter` factory pattern — each call gets its own isolated `Map` of attempts
- Route handlers pass unexpected errors to `next(err)` — 400/401/403/404 remain explicit returns

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- Server starts cleanly on port 3099 (port 3000 already in use by running instance)
- Zero `JSON.parse` in `incidents.js` (was 3x repeated)
- Zero direct `db` import in `incidents.js`
- Zero `process.env` reads in `middleware/auth.js`
- `errorHandler` registered as last middleware in `index.js`
- `IncidentService` referenced 9 times in `incidents.js`

## Self-Check: PASSED

- server/middleware/errorHandler.js: exists
- server/middleware/rateLimiter.js: exists
- server/services/IncidentService.js: exists
- Commits 2c698af and 6f9d829: verified in git log
