# Backups de Turso

Backup automático semanal de la base de datos Turso vía GitHub Actions.

## Funcionamiento

- **Workflow**: `.github/workflows/turso-backup.yml`
- **Cuándo**: cada lunes 04:00 UTC + disparo manual desde Actions
- **Qué hace**:
  1. Descarga el dump via endpoint HTTP de Turso (`/dump`)
  2. Verifica el restore cargándolo en una SQLite temporal y comprobando que existen las tablas `users` e `incidents`
  3. Comprime con `gzip -9`
  4. Publica como **Release** con tag `backup-YYYY-MM-DD-HHMM`
  5. Rota: mantiene las 12 releases más recientes con prefijo `backup-`

## Secrets requeridos en GitHub

En `Settings → Secrets and variables → Actions`:

| Secret | Valor |
|---|---|
| `TURSO_DATABASE_URL` | El mismo `libsql://...` que usa el servidor |
| `TURSO_AUTH_TOKEN` | El mismo token que usa el servidor |

No hay secrets adicionales: el upload a Releases usa el `GITHUB_TOKEN` built-in.

## ⚠️ Dependencia crítica: `CRYPTO_SECRET`

A partir del PR de cifrado de API keys, los campos `users.clickup_api_key`, `anthropic_api_key` y `openai_api_key` van **cifrados con AES-256-GCM** usando la env var `CRYPTO_SECRET` del servidor.

- Los `.sql.gz` de Releases contienen los **valores cifrados**, no los originales.
- Para restaurar un dump y que la app pueda volver a usar esas keys, necesitas **el mismo `CRYPTO_SECRET`** con el que se cifraron.
- Si pierdes el secret, los dumps siguen sirviendo para usuarios/incidencias pero las API keys habrá que reintroducirlas a mano.

Guarda `CRYPTO_SECRET` en al menos: Render env, tu `.env` local y un gestor de secretos (1Password/Bitwarden).

## Restore manual

```bash
# 1. Descargar el backup más reciente
gh release list --repo dmartorell/RecUp --limit 1 \
  --json tagName --jq '.[0].tagName' \
  | xargs -I{} gh release download {} --repo dmartorell/RecUp --pattern '*.sql.gz'

# 2. Descomprimir
gunzip recup-*.sql.gz

# 3a. Restore a SQLite local (para inspeccionar)
sqlite3 restored.db < recup-*.sql

# 3b. Restore a una DB nueva de Turso
turso db create recup-restored --from-file recup-*.sql
```

## Probar el script localmente

```bash
export TURSO_DATABASE_URL="libsql://<db>-<org>.turso.io"
export TURSO_AUTH_TOKEN="<token>"
export OUT_DIR=/tmp/recup-backup
./scripts/backup-turso.sh
```

Requiere `sqlite3` (preinstalado en macOS y en `ubuntu-latest`).

## Disparo manual

```bash
gh workflow run turso-backup.yml --repo dmartorell/RecUp
```

O desde la UI: `Actions → Turso Backup → Run workflow`.
