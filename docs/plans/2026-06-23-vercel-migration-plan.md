# Plan de migración de RecUp a Vercel

Fecha: 2026-06-23

## Objetivo

Desacoplar RecUp completamente de Render, migrar el código desde el repositorio GitHub actual al Bitbucket de empresa y hospedar **frontend y backend en un único proyecto de Vercel**, manteniendo los contratos actuales de la aplicación.

La migración debe preservar:

- Las rutas públicas existentes `/api/*`.
- El frontend vanilla JS actual servido desde `src/`.
- La compatibilidad con la extensión de Chrome.
- El uso de Turso/libSQL como base de datos.
- Las integraciones existentes con Anthropic/OpenAI, ClickUp y Sentry.
- El formato de `localStorage.recup_session`, query params y flujos actuales.

No forma parte de este plan migrar a React, rediseñar la UI ni cambiar contratos API.

## Arquitectura objetivo

```txt
Vercel Project: RecUp
├─ Frontend estático
│  └─ src/index.html, src/js/*, src/css/*, src/img/*
│
└─ Backend API
   └─ /api/* ejecutado en Vercel Functions reutilizando Express
```

Desde el navegador:

```txt
https://recup.example.com/          -> frontend
https://recup.example.com/api/auth  -> backend
https://recup.example.com/api/...   -> backend
```

## Estrategia recomendada

Usar una **migración mínima**:

1. Mantener `server/app.js` como definición central de Express.
2. Mantener `server/index.js` para desarrollo local y ejecución tradicional.
3. Añadir una entrada serverless para Vercel, por ejemplo `api/index.js`.
4. Añadir `vercel.json` para enrutar `/api/*` al backend y el resto al frontend estático.
5. Configurar variables de entorno en Vercel.
6. Desplegar primero en preview desde Bitbucket.
7. Validar flujos críticos antes de cambiar el dominio productivo.

Esta opción reduce riesgo porque no reescribe el backend ni toca los contratos del frontend.

## Cambios técnicos previstos

### 1. Entrada serverless para Vercel

Crear un punto de entrada dedicado para Vercel, conceptualmente:

```js
import { app } from '../server/app.js';
import { initDb } from '../server/db.js';

let initPromise;

function ensureDb() {
  initPromise ||= initDb();
  return initPromise;
}

export default async function handler(req, res) {
  await ensureDb();
  return app(req, res);
}
```

Notas:

- No debe llamar a `app.listen()`.
- Debe reutilizar el `app` existente.
- La inicialización de DB debe cachearse por instancia para reducir impacto de cold starts.

### 2. Mantener `server/index.js`

`server/index.js` seguirá siendo útil para desarrollo local:

```bash
bun --watch server/index.js
```

También sirve como fallback si en el futuro se necesita volver a un runtime Node persistente.

### 3. Configuración de `vercel.json`

Añadir configuración para:

- Enviar `/api/*` a la function de backend.
- Servir el frontend estático desde `src/`.
- Aplicar fallback a `src/index.html` para rutas del frontend si hiciera falta.

La configuración exacta debe validarse con un deploy preview, pero el objetivo es mantener URLs actuales sin cambios.

### 4. Variables de entorno en Vercel

Configurar en el proyecto Vercel:

```txt
TURSO_DATABASE_URL
TURSO_AUTH_TOKEN
ANTHROPIC_API_KEY
CLICKUP_API_KEY
JWT_SECRET
CRYPTO_SECRET
ALLOWED_EMAIL_DOMAIN
SENTRY_DSN
SENTRY_ENVIRONMENT
PORT
```

Notas:

- `PORT` no debería ser relevante para Vercel Functions, pero puede mantenerse por compatibilidad.
- `CRYPTO_SECRET` es crítico: si ya existen claves cifradas en la base de datos, debe ser exactamente el mismo valor usado en producción anterior.
- No copiar ni exponer valores secretos en el repositorio.

## Riesgos identificados

### 1. Cold starts

En Vercel Functions habrá cold starts. El primer request tras un periodo de inactividad puede tardar más porque Vercel debe arrancar el runtime Node, cargar módulos e inicializar dependencias.

Mitigación:

- Cachear `initDb()` por instancia.
- Evitar migraciones pesadas en runtime a medio plazo.
- Medir latencia real en preview.

### 2. Inicialización y migraciones de base de datos

Actualmente `initDb()` crea tablas, añade columnas y puede migrar claves API a formato cifrado.

En serverless esto puede ejecutarse en cold starts, lo que no es ideal.

Mitigación inicial:

- Cachear la inicialización por instancia.

Mejora posterior recomendada:

- Separar migraciones en un script ejecutado manualmente o durante despliegue.
- Dejar el runtime solo para atender requests.

### 3. Timeouts en IA

`/api/summarize` llama a Anthropic/OpenAI y puede tardar hasta 30 segundos.

Riesgo:

- El límite de duración de Vercel Functions depende del plan contratado.
- Si el timeout de Vercel es menor que el tiempo real de respuesta, la request fallará.

Mitigación:

- Confirmar límites del plan Vercel.
- Probar resúmenes largos en preview.
- Si falla, valorar bajar timeout, optimizar prompt/modelo o rediseñar el flujo como asíncrono.

### 4. Attachments

`/api/attachment` usa `multer.memoryStorage()` y sube archivos a ClickUp.

Riesgo:

- Límites de tamaño de request.
- Límites de memoria.
- Límites de duración.

Mitigación:

- Probar adjuntos reales en preview.
- Documentar tamaño máximo aceptable.
- Si los archivos son grandes, valorar subida directa o almacenamiento temporal externo.

### 5. Rate limiter en memoria

El rate limiter actual es in-memory. En Vercel no será global ni persistente porque las instancias son efímeras.

Riesgo:

- Menor protección real en producción.

Mitigación inicial:

- Aceptarlo como deuda técnica si el riesgo es bajo.

Mejora posterior recomendada:

- Migrar el rate limiter a Upstash Redis, Vercel KV, Turso u otro almacenamiento compartido.

### 6. Cachés en memoria

Cualquier caché en memoria, como la caché de resolución de usuarios ClickUp, será best-effort.

Impacto:

- No debería romper funcionalidad.
- Puede aumentar llamadas a ClickUp tras cold starts o cambios de instancia.

### 7. Sentry

Sentry debe inicializarse correctamente antes que el resto de módulos del backend.

Riesgo:

- La estrategia actual usa `--import ./server/instrument.js` en el script `start`.
- En Vercel puede ser necesario importar explícitamente `server/instrument.js` desde la entrada serverless para mantener la instrumentación.

Mitigación:

- Validar captura de errores en preview.
- Forzar import de instrumentación en la entrada de Vercel si hace falta.

## Plan por fases

### Fase -1 — Migración GitHub personal → Bitbucket empresa

Objetivo: que Bitbucket sea el repositorio fuente usado por Vercel sin perder historial Git.

Pasos:

- Congelar el estado actual en GitHub y asegurar que no quedan cambios locales sin commit.
- Crear un repositorio privado vacío en Bitbucket empresa.
- Verificar que no hay secretos trackeados antes de subir al repo corporativo.
- Añadir Bitbucket como remote temporal, por ejemplo `bitbucket`.
- Subir ramas necesarias y tags.
- Validar en Bitbucket que historial, ramas y tags se han migrado correctamente.
- Renombrar remotes para que Bitbucket pase a ser `origin` y GitHub quede como remote secundario o referencia temporal.
- Bloquear nuevos cambios directos en GitHub para evitar divergencias.

Comandos orientativos:

```bash
git status
git remote -v
git remote add bitbucket git@bitbucket.org:empresa/recup.git
git push bitbucket main
git push bitbucket --tags
git remote rename origin github
git remote rename bitbucket origin
git remote -v
```

Si la rama principal no es `main`, usar el nombre real de la rama.

Verificación de seguridad antes de migrar:

```bash
git ls-files | grep -E '^\\.env|\\.pem$|\\.key$|secrets/'
```

No leer ni imprimir contenido de secretos. Si aparece algún secreto trackeado o hay sospecha de secretos en el historial, detener la migración y limpiar historial antes de importar en Bitbucket.

### Fase 0 — Preparación Vercel

- Confirmar que el despliegue se hará desde Bitbucket hacia Vercel.
- Confirmar proyecto Vercel de destino.
- Confirmar dominio final, aunque no es necesario para desarrollar en preview.
- Confirmar plan Vercel y límites de functions.
- Inventariar variables de entorno actuales sin exponer valores.
- Confirmar quién tiene permisos para configurar variables, dominios y pipelines.

### Fase 1 — Adaptación mínima del repositorio

- Crear branch de migración desde Bitbucket, por ejemplo `deploy/vercel`.
- Añadir entrada `api/index.js` para Vercel.
- Añadir `vercel.json`.
- Asegurar que `server/index.js` sigue funcionando en local.
- Asegurar que `/api/*` conserva las mismas rutas y respuestas.
- No modificar contratos frontend/backend.

### Fase 2 — Configuración en Vercel

- Crear/configurar proyecto Vercel conectado al repo de Bitbucket empresa.
- Configurar framework como proyecto Node/static según corresponda.
- Configurar variables de entorno.
- Configurar entorno preview y production.
- Verificar que no se suben secretos al repositorio.
- Confirmar que cada push/PR desde Bitbucket genera deploy preview.

### Fase 3 — Deploy preview

Ejecutar deploy preview y validar:

- Carga de `src/index.html`.
- Carga de CSS, JS e imágenes.
- `GET /api/version`.
- Registro/login.
- Persistencia de sesión.
- Settings de usuario.
- Creación/listado/actualización/borrado de incidentes.
- Resumen con Anthropic/OpenAI.
- Creación de ticket en ClickUp.
- Subida de attachments.
- Compatibilidad con query params de la extensión Chrome.
- Limpieza de URL con `history.replaceState`.
- Captura de errores en Sentry.

### Fase 4 — Hardening antes de producción

- Medir latencia de cold start.
- Medir tiempos de `/api/summarize`.
- Probar adjuntos con tamaños reales.
- Revisar logs de Vercel.
- Revisar errores Sentry.
- Confirmar que Turso recibe tráfico correctamente.
- Confirmar que las claves cifradas se descifran con el `CRYPTO_SECRET` configurado.

### Fase 5 — Cutover

- Configurar dominio productivo en Vercel.
- Cambiar DNS desde Render hacia Vercel.
- Mantener Render disponible temporalmente como rollback.
- Monitorizar logs y Sentry durante las primeras horas.
- Validar flujos críticos con usuarios reales o cuenta de prueba.

### Fase 6 — Retirada de Render

Cuando Vercel esté validado:

- Apagar servicio en Render.
- Eliminar variables o accesos que ya no sean necesarios.
- Actualizar documentación operativa.
- Actualizar README si menciona Render.
- Revisar pipelines antiguos.

## Checklist de aceptación

La migración se considera correcta si:

- El dominio productivo sirve el frontend desde Vercel.
- Todas las rutas `/api/*` responden desde Vercel.
- No hay dependencias operativas de Render.
- Login/register funcionan.
- Los incidentes se guardan y recuperan desde Turso.
- El resumen IA funciona en producción.
- La creación de tickets ClickUp funciona.
- Los attachments funcionan con tamaños esperados.
- La extensión Chrome sigue abriendo RecUp con query params compatibles.
- Sentry recibe errores del entorno Vercel.
- No se han cambiado contratos públicos ni formatos de datos.

## Mejoras posteriores recomendadas

No son necesarias para el primer despliegue, pero conviene planificarlas:

1. Separar migraciones de DB del runtime serverless.
2. Sustituir rate limiter in-memory por almacenamiento compartido.
3. Revisar estrategia de uploads si los attachments crecen.
4. Añadir tests o smoke tests para endpoints críticos.
5. Documentar proceso de deploy Vercel/Bitbucket.
6. Revisar límites de timeout si aumenta el uso de IA.

## Recomendación final

Proceder con una migración mínima y controlada:

- Express sigue siendo el backend.
- Vercel Functions lo ejecutan detrás de `/api/*`.
- El frontend vanilla se sirve estáticamente desde el mismo proyecto.
- No se cambia la arquitectura funcional de RecUp durante la migración.

Esto minimiza riesgo y permite desacoplarse de Render sin una reescritura innecesaria.
