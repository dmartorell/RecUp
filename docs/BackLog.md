# BackLog — Preparación para producción

## Pendientes

### Infra / Operaciones

- [ ] **Backup automático de Turso**
  - Script `turso db dump` semanal, comprimido (gzip).
  - Destino: Google Drive privado o repo Git privado.
  - Coste: 0€ (consumo de cuota despreciable: ~60k reads/mes vs 1B free).
  - Tamaño esperado: 1-2 MB comprimido.
  - Frecuencia recomendada: semanal.

- [ ] **Proteger rama `main` en GitHub (opción A)**
  - Configurar branch protection: prohibir push directo a `main`, exigir merge desde PR.
  - Render seguirá auto-desplegando al mergear a `main`.
  - Esfuerzo: 5 min en Settings del repo.
  - Objetivo: red de seguridad mínima antes de que producción afecte a varios equipos.

### Observabilidad / Errores

- [ ] **Sentry para captura de errores frontend + backend**
  - Instalar `@sentry/node` (backend) y `@sentry/browser` (frontend).
  - Free tier suficiente (5k errores/mes).
  - Permite enterarse de fallos antes de que el usuario los reporte.
  - Esfuerzo: ~30 min de setup.

- [ ] **Eliminar `logDbError` y carpeta `dbLogs/`**
  - Código muerto en `server/db.js:11-19` (función no se llama desde ningún sitio).
  - Quitar también `dbLogs/*.log` del `.gitignore` (línea 6).
  - Sentry cubrirá el caso de uso original.
  - Esfuerzo: 5 min.

### Seguridad

#### Críticos (innegociables para producción)

- [ ] **Arreglar rate limiter detrás del proxy de Render**
  - `server/middleware/rateLimiter.js:6` usa `req.ip` directamente.
  - Sin `app.set('trust proxy', 1)` en `server/app.js`, todos los usuarios comparten contador (la IP es la del proxy de Render).
  - Fix: añadir `app.set('trust proxy', 1)` y verificar que `req.ip` devuelve la IP real del cliente.
  - Esfuerzo: 5 min + test.

- [ ] **Cifrar API keys en DB y dejar de devolverlas al cliente**
  - `users.clickup_api_key`, `anthropic_api_key`, `openai_api_key` están en texto plano.
  - `GET /api/settings` (`server/routes/settings.js:9-26`) devuelve las claves enteras al frontend.
  - Riesgo: un token JWT robado expone API keys de ClickUp (workspace completo) y Anthropic/OpenAI (facturación del usuario).
  - Fix:
    - Cifrar al insertar con AES-256-GCM usando una `CRYPTO_SECRET` en env.
    - Cambiar `GET /api/settings` para devolver solo booleano "configurada" + últimos 4 chars como pista (`••••abcd`).
    - El usuario solo introduce la key entera al cambiarla.
  - Esfuerzo: 1-2 h.

- [ ] **Validar `event.origin` en handler de `postMessage`**
  - `src/js/app.js:565` acepta tokens vía `window.postMessage` sin verificar origen.
  - Cualquier iframe/ventana puede suplantar la sesión.
  - Fix: lista blanca explícita de orígenes permitidos (la extensión Chrome y el propio dominio).
  - Esfuerzo: 15 min.

- [ ] **Cambiar handshake con extensión Chrome: tokens de un solo uso**
  - Hoy la extensión pasa el JWT real vía `?token=...` en la URL (`src/js/app.js:532-541`).
  - El token (válido 30 días) queda en logs de Render, historial del navegador, Chrome sync, otras extensiones, proxies corporativos.
  - Fix: la extensión genera un `code` de un solo uso (UUID, TTL 30s) → frontend lo intercambia por el JWT vía `POST /api/auth/exchange` con cuerpo (no URL).
  - Esfuerzo: 3-4 h (cambios en extensión + endpoint nuevo en backend).

#### Altos

- [ ] **Reducir validez del JWT a 7 días + mecanismo de revocación**
  - Hoy `JWT_EXPIRES_IN = '30d'` (`server/config/constants.js`) sin forma de revocar.
  - Si alguien sale del equipo, su token sigue válido un mes.
  - Fix:
    - Reducir a 7 días.
    - Añadir columna `users.token_version` (entero, default 0).
    - Incluir `token_version` en el payload del JWT.
    - `authMiddleware` verifica que el `token_version` del JWT coincide con el de la DB.
    - Endpoint "logout everywhere" / botón de "expulsar usuario" incrementa el contador → todos sus tokens invalidados.
  - Esfuerzo: 2-3 h.

- [ ] **Mitigar enumeración de emails (timing attack en login)**
  - `server/routes/auth.js:71-78`: si el usuario no existe, respuesta inmediata; si existe, espera a `bcrypt.compare` (~100ms).
  - Permite enumerar emails registrados midiendo tiempos.
  - Fix: ejecutar siempre un `bcrypt.compare` (contra un hash dummy si el usuario no existe).
  - Esfuerzo: 10 min.

- [ ] **Subir bcrypt rounds a 12 y password mínima a 8 caracteres**
  - `server/routes/auth.js:35` usa `bcrypt.hash(password, 10)` → debería ser 12.
  - `server/routes/auth.js:23` permite contraseñas de 6 chars → debería ser 8 mínimo.
  - Esfuerzo: 2 min.

#### Medios

- [ ] **Auditar uso de `innerHTML` / `insertAdjacentHTML` en frontend**
  - Token en `localStorage` → cualquier XSS lo roba.
  - Buscar todas las inyecciones de HTML con contenido del usuario (`title`, `transcript`, `bullets`) en `src/js/`.
  - Sanitizar o pasar a `textContent` / `createElement`.
  - Esfuerzo: 1-2 h de auditoría + fixes.

- [ ] **Añadir `await` en update de avatar**
  - `server/routes/auth.js:87`: `db.execute({...})` sin `await`.
  - Race condition menor: response puede irse antes del UPDATE.
  - Esfuerzo: 1 min.

- [ ] **Decidir tratamiento de `EMAIL_TAKEN` en registro**
  - `server/routes/auth.js:50-52` devuelve 409 si email ya existe → enumeración.
  - Para uso interno con `ALLOWED_EMAIL_DOMAIN` activado, el riesgo se reduce (atacante ya conoce el dominio).
  - Decisión: aceptar el tradeoff o devolver respuesta genérica + email al usuario afectado.

#### Futuro (v2)

- [ ] **Migrar a cookies `httpOnly; Secure; SameSite=Strict`**
  - JWT inaccesible desde JavaScript → XSS no roba sesión.
  - Requiere cambios en frontend, backend y extensión.
  - Esfuerzo: 1-2 días.
