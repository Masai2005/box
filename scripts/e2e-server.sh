#!/bin/sh
# Build and run a throwaway Ekilie Box instance for Playwright.
set -eu

cd "$(dirname "$0")/.."

DATA=${E2E_DATA_DIR:-/tmp/ekilie-box-e2e-data}
BINARY=${E2E_BINARY:-/tmp/ekilie-box-e2e}
PORT=${E2E_PORT:-18099}
EMAIL=${E2E_EMAIL:-e2e@ekilie.test}
PASSWORD=${E2E_PASSWORD:-E2ePass1234!}

rm -rf "$DATA"
mkdir -p "$(dirname "$BINARY")"

if [ "${E2E_SKIP_UI:-0}" != "1" ]; then
  (cd web && bun install --frozen-lockfile && bun run build)
fi

CGO_ENABLED=0 go build -tags no_ui -trimpath -o "$BINARY" ./cmd/box
"$BINARY" superuser upsert "$EMAIL" "$PASSWORD" --dir "$DATA" >/dev/null

"$BINARY" serve --dir "$DATA" --http "127.0.0.1:$PORT" &
pid=$!
cleanup() {
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  rm -rf "$DATA" "$BINARY"
}
trap cleanup EXIT INT TERM
wait "$pid"
