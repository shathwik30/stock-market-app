#!/usr/bin/env bash
# VM deployment script. Run from the project root on the target VM.
#
# Env is loaded from the first of:
#   1. .env.local in project root
#   2. .env in project root
#   3. /etc/stock-market-app.env  (canonical VM location)
#
# Usage:
#   ./scripts/deploy.sh          # install + migrate + build
#   ./scripts/deploy.sh --start  # same, then run `npm start`

set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE=""
for f in .env.local .env /etc/stock-market-app.env; do
  if [[ -f "$f" ]]; then
    ENV_FILE="$f"
    break
  fi
done
if [[ -z "$ENV_FILE" ]]; then
  echo "ERROR: no env file found (.env.local / .env / /etc/stock-market-app.env)" >&2
  exit 1
fi
echo "==> Loading env from $ENV_FILE"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${DATABASE_URL:?DATABASE_URL must be set}"
: "${JWT_SECRET:?JWT_SECRET must be set}"
: "${CRON_SECRET:?CRON_SECRET must be set}"

echo "==> node $(node -v) / npm $(npm -v)"

echo "==> Installing dependencies (npm ci)"
npm ci --no-audit --no-fund

echo "==> Applying database migrations"
npx prisma migrate deploy

echo "==> Building Next.js (standalone)"
NODE_ENV=production npm run build

echo "==> Build complete. Standalone server at .next/standalone/server.js"

if [[ "${1:-}" == "--start" ]]; then
  echo "==> Starting server on :${PORT:-3000}"
  exec npm start
fi
