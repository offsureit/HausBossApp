#!/usr/bin/env bash
# Resets the Maestro fixture jobs. Needs: DATABASE_URL (admin connection), MAESTRO_COMPANY_ID,
# MAESTRO_TECH_ID, MAESTRO_TECH_NAME, MAESTRO_OWNER_ID. Local defaults match the seed data.
set -euo pipefail
cd "$(dirname "$0")"
: "${DATABASE_URL:=postgresql://postgres:postgres@localhost:5439/hausboss}"
: "${MAESTRO_COMPANY_ID:?set MAESTRO_COMPANY_ID}"
: "${MAESTRO_TECH_ID:?set MAESTRO_TECH_ID}"
: "${MAESTRO_TECH_NAME:?set MAESTRO_TECH_NAME}"
: "${MAESTRO_OWNER_ID:?set MAESTRO_OWNER_ID}"
TODAY="${MAESTRO_TODAY:-$(date -u +%Y-%m-%dT08:00:00Z)}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q \
  -v company="$MAESTRO_COMPANY_ID" -v tech="$MAESTRO_TECH_ID" -v tech_name="$MAESTRO_TECH_NAME" -v owner="$MAESTRO_OWNER_ID" -v today="$TODAY" \
  -f reset.sql
echo "fixtures reset (company $MAESTRO_COMPANY_ID, tech $MAESTRO_TECH_NAME, day $TODAY)"
