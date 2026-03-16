---
phase: 03-refactorizar-backend
plan: 01
subsystem: api
tags: [config, env-vars, constants, system-prompt]

requires: []
provides:
  - Centralized constants module with all hardcoded values (ClickUp IDs, Claude model, timeouts, rate limits, multer limits)
  - Env var validation at startup — JWT_SECRET required, server exits on missing
  - System prompt extracted to text file for maintainability
affects:
  - 03-02 (IncidentService, ClickUpService — will import constants)
  - 03-03 (auth middleware, rate limiting — will import constants)

tech-stack:
  added: []
  patterns:
    - Config-first: env.js imported before any route/middleware
    - Constants module: single source of truth for all magic values
    - Required vs optional env vars with explicit crash on missing required

key-files:
  created:
    - server/config/constants.js
    - server/config/env.js
    - server/config/prompts/summarize-system.txt
  modified:
    - server/index.js

key-decisions:
  - "JWT_SECRET is required (no insecure fallback) — server exits with FATAL log if missing"
  - "ANTHROPIC_API_KEY and ClickUp keys are optional — server starts but warns"
  - "dotenv/config moved from index.js to env.js so config loads first"

patterns-established:
  - "Config layer pattern: all env access via config object, never process.env in route files"

requirements-completed: [BE-CONFIG, BE-ENV, BE-PROMPT]

duration: 8min
completed: 2026-03-16
---

# Phase 03 Plan 01: Config Foundation Summary

**Centralized constants module, startup env var validation (JWT_SECRET required), and system prompt extracted to server/config/prompts/summarize-system.txt**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-16T17:43:00Z
- **Completed:** 2026-03-16T17:51:35Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- All hardcoded magic values (11 exports) extracted to `server/config/constants.js`
- Env var validation at startup via `server/config/env.js` — JWT_SECRET required with no fallback
- System prompt moved from inline JS string to `server/config/prompts/summarize-system.txt`
- `server/index.js` updated to import config instead of dotenv/config directly

## Task Commits

Each task was committed atomically:

1. **Task 1: Create constants.js and env.js config modules** - `0d53a70` (feat)
2. **Task 2: Extract system prompt to file and update index.js** - `795bf66` (feat)

## Files Created/Modified

- `server/config/constants.js` - All extracted constants (11 exports)
- `server/config/env.js` - Env var validation at import time; JWT_SECRET required
- `server/config/prompts/summarize-system.txt` - System prompt for summarize endpoint
- `server/index.js` - Uses config from env.js instead of dotenv/config and process.env directly

## Decisions Made

- JWT_SECRET required with no fallback — eliminates the `'dev-secret-change-me'` insecure default
- ANTHROPIC_API_KEY, CLICKUP_API_KEY, CLICKUP_LIST_ID remain optional — server degrades gracefully with warnings
- PORT remains optional with default '3000'

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Config foundation complete. Plans 02 and 03 can now import from `server/config/constants.js` and `server/config/env.js`
- Route files still use hardcoded values directly — Plans 02 and 03 will replace those references

---
*Phase: 03-refactorizar-backend*
*Completed: 2026-03-16*
