#!/usr/bin/env bash
# One-time Postgres bootstrap on the VM.
# Creates the role + database and prints a DATABASE_URL for /etc/stock-market-app.env.
#
# Run as root on Ubuntu/Debian:
#   sudo bash scripts/pg-setup.sh

set -euo pipefail

DB_NAME="${DB_NAME:-stockmarket}"
DB_USER="${DB_USER:-stockapp}"
DB_PASS="${DB_PASS:-$(openssl rand -hex 16)}"

if [[ $EUID -ne 0 ]]; then
  echo "Run as root (sudo)." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "==> Installing postgresql"
  apt-get update -y
  apt-get install -y postgresql postgresql-contrib
fi

systemctl enable --now postgresql

sudo -u postgres psql <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}')\gexec

GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
SQL

cat <<OUT

==> Postgres is up. Put this line in /etc/stock-market-app.env:

DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}?schema=public"

Notes:
 - Password printed only this once. Record it in a password manager.
 - pg_hba.conf default 'scram-sha-256' on localhost is fine; no edits needed.
 - Next step: run ./scripts/deploy.sh — it runs 'prisma migrate deploy' against this DB.
OUT
