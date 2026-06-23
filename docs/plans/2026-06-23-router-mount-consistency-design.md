# Router mount consistency design

## Objective

Make Express route mounting consistent across `server/app.js` and `server/routes/*.js` without changing any public API URL or request/response contract.

## Decision

Adopt one convention across the backend:

- `server/app.js` owns all base prefixes like `/api/auth`
- each router file defines only relative paths like `/`, `/login`, `/:id`

## Current state

The codebase currently mixes two patterns:

1. routers mounted directly in `app.js` while defining full paths inside the router file
2. routers mounted with a base prefix in `app.js` while defining relative paths inside the router file

Example:

- `incidentsRouter` already uses the preferred pattern
- `authRouter`, `settingsRouter`, and likely others define `/api/...` paths internally

This works, but it spreads routing responsibility across two places and makes the structure less predictable.

## Target convention

### In `server/app.js`

Mount all routers with explicit prefixes:

- `app.use('/api/auth', authRouter);`
- `app.use('/api/summarize', summarizeRouter);`
- `app.use('/api/ticket', ticketRouter);`
- `app.use('/api/version', versionRouter);`
- `app.use('/api/attachment', attachmentRouter);`
- `app.use('/api/incidents', incidentsRouter);`
- `app.use('/api/settings', settingsRouter);`

### In `server/routes/*.js`

Use only relative paths.

Examples:

- `auth.js`
  - `router.post('/register', ...)`
  - `router.post('/login', ...)`
  - `router.get('/me', ...)`
- `settings.js`
  - `router.get('/', ...)`
  - `router.put('/', ...)`
- `incidents.js`
  - keep as-is because it already follows the target pattern

## Non-goals

- no public endpoint renames
- no JSON contract changes
- no auth behavior changes
- no middleware logic changes
- no DB or service-layer refactor

## Files likely affected

- `server/app.js`
- `server/routes/auth.js`
- `server/routes/settings.js`
- `server/routes/summarize.js`
- `server/routes/ticket.js`
- `server/routes/version.js`
- `server/routes/attachment.js`
- tests that hardcode route paths, if any need adjustment because of internal rewrites

## Refactor plan

1. Inspect each router file and list its current full paths.
2. For each router, remove the shared `/api/...` prefix from route definitions.
3. Add the corresponding mount prefix in `server/app.js`.
4. Keep route-specific middleware exactly where it is unless a router-level middleware already applies correctly.
5. Run tests to confirm no public behavior changed.
6. Manually smoke test the main endpoints.

## Example transformation

### Before

In `server/app.js`:

```js
app.use(authRouter);
```

In `server/routes/auth.js`:

```js
router.post('/api/auth/register', ...)
router.post('/api/auth/login', ...)
```

### After

In `server/app.js`:

```js
app.use('/api/auth', authRouter);
```

In `server/routes/auth.js`:

```js
router.post('/register', ...)
router.post('/login', ...)
```

Public URLs remain identical.

## Risks

### 1. Double prefix or missing prefix

A route may accidentally end up as:

- `/api/auth/api/auth/login`
- `/login`

Mitigation:
- review every router after the change
- compare final mounted URLs against the current endpoint list

### 2. Hidden tests or frontend assumptions

Even if public URLs stay the same, tests may depend on the old internal shape of route definitions.

Mitigation:
- run `bun test`
- grep for route strings in tests and frontend code if needed

### 3. Middleware scope changes by mistake

If a route-level middleware is moved carelessly, behavior could change.

Mitigation:
- do not restructure middleware unless necessary
- keep handlers and middleware attached to the same relative route after refactor

## Validation checklist

### Automated

- run `bun test`
- optionally run targeted auth/settings/incidents tests if present

### Manual

Verify these still work exactly the same:

- `POST /api/auth/register`
- `POST /api/auth/login`
- auth-protected route(s) such as `/api/settings`
- incidents CRUD under `/api/incidents`
- summarize/ticket/version/attachment endpoints

## Success criteria

The refactor is successful if:

- all routers follow one mounting convention
- all public URLs remain unchanged
- tests pass
- no frontend or extension integration requires changes

## Recommended execution order

1. `auth.js`
2. `settings.js`
3. `summarize.js`
4. `ticket.js`
5. `version.js`
6. `attachment.js`
7. final pass on `server/app.js`
8. run tests and smoke checks

## Notes

`incidentsRouter` should be treated as the reference implementation for the desired pattern, since it already uses a base mount plus relative router paths.