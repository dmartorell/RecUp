#!/usr/bin/env bash
set -euo pipefail

: "${TURSO_DATABASE_URL:?missing TURSO_DATABASE_URL}"
: "${TURSO_AUTH_TOKEN:?missing TURSO_AUTH_TOKEN}"

strip() {
  local s="$1"
  s="${s//$'\r'/}"
  s="${s//$'\n'/}"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}
TURSO_DATABASE_URL="$(strip "$TURSO_DATABASE_URL")"
TURSO_AUTH_TOKEN="$(strip "$TURSO_AUTH_TOKEN")"

if [[ "$TURSO_DATABASE_URL" != libsql://* ]]; then
  echo "ERROR: TURSO_DATABASE_URL must start with libsql:// (got: '${TURSO_DATABASE_URL:0:20}...')"
  exit 1
fi

OUT_DIR="${OUT_DIR:-.}"
STAMP="$(date -u +%Y-%m-%d-%H%M)"
BASE_URL="${TURSO_DATABASE_URL/libsql:\/\//https://}"
BASE_URL="${BASE_URL%/}"
DUMP_URL="${BASE_URL}/dump"
SQL_FILE="${OUT_DIR}/recup-${STAMP}.sql"
GZ_FILE="${OUT_DIR}/recup-${STAMP}.sql.gz"

mkdir -p "$OUT_DIR"

echo "==> Dumping ${BASE_URL}/dump"
http_code=$(curl -sSL -w "%{http_code}" \
  -H "Authorization: Bearer ${TURSO_AUTH_TOKEN}" \
  -o "$SQL_FILE" \
  "$DUMP_URL")

if [ "$http_code" != "200" ]; then
  echo "ERROR: dump request returned HTTP $http_code"
  head -c 500 "$SQL_FILE" || true
  rm -f "$SQL_FILE"
  exit 1
fi

if [ ! -s "$SQL_FILE" ]; then
  echo "ERROR: dump file is empty"
  rm -f "$SQL_FILE"
  exit 1
fi

echo "==> Verifying restore on temp SQLite"
VERIFY_DB="$(mktemp -u).db"
trap 'rm -f "$VERIFY_DB"' EXIT

if ! sqlite3 "$VERIFY_DB" < "$SQL_FILE"; then
  echo "ERROR: dump failed to load into SQLite"
  exit 1
fi

TABLES="$(sqlite3 "$VERIFY_DB" ".tables")"
for required in users incidents; do
  if ! echo "$TABLES" | tr -s ' \n' '\n' | grep -qx "$required"; then
    echo "ERROR: table '$required' missing in restored dump"
    exit 1
  fi
done

USER_COUNT=$(sqlite3 "$VERIFY_DB" "SELECT COUNT(*) FROM users")
INCIDENT_COUNT=$(sqlite3 "$VERIFY_DB" "SELECT COUNT(*) FROM incidents")
echo "    users:     $USER_COUNT"
echo "    incidents: $INCIDENT_COUNT"

echo "==> Compressing"
gzip -9 "$SQL_FILE"
ls -lh "$GZ_FILE"

echo "==> OK: $GZ_FILE"
