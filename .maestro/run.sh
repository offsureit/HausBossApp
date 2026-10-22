#!/usr/bin/env bash
# Runs the Maestro flows against an Android emulator/device with a dev client installed.
#
#   cp .maestro/.env.example .maestro/.env.local   # accounts + ids (never committed)
#   .maestro/run.sh                                # all flows
#   .maestro/run.sh 02-technician-completes-job    # one flow
#
# Each run resets the fixture jobs (fixtures/reset.sh), runs the flows with the Maestro CLI
# (https://maestro.mobile.dev, `curl -fsSL https://get.maestro.mobile.dev | bash`) and, after the
# offline flow, checks on the server that the queued status change really arrived.
set -euo pipefail
cd "$(dirname "$0")"
if [[ -f .env.local ]]; then set -a; . ./.env.local; set +a; fi
export PATH="$HOME/.maestro/bin:$PATH"
: "${TECH_EMAIL:?}" "${TECH_PASSWORD:?}" "${OWNER_EMAIL:?}" "${OWNER_PASSWORD:?}" "${TECH_NAME:?}" "${MANAGER_NAME:?}"
OUT="${MAESTRO_OUTPUT:-$PWD/output}"
mkdir -p "$OUT"

flows=("$@")
if [[ ${#flows[@]} -eq 0 ]]; then flows=(01-login 02-technician-completes-job 03-dispatcher-reassigns 04-offline-status-sync); fi
# Dev client: Maestro's launchApp would open the dev launcher, so the data is cleared and the
# permissions granted here, and the flow opens the Metro bundle through the dev-client link.
prepare_dev_client() {
  adb shell pm clear app.hausboss.mobile >/dev/null
  for perm in POST_NOTIFICATIONS ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION ACCESS_BACKGROUND_LOCATION CAMERA; do
    adb shell pm grant app.hausboss.mobile "android.permission.$perm" 2>/dev/null || true
  done
  adb shell cmd connectivity airplane-mode disable >/dev/null 2>&1 || true
}

# Server-side checks after a flow: the reassigned job must point at the manager; the queued
# Accept must be on the row (the fixtures are reset before every flow, so check right after it).
check_server() {
  [[ -n "${DATABASE_URL:-}" ]] || return 0
  case "$1" in
    03-dispatcher-reassigns)
      [[ -n "${MAESTRO_MANAGER_ID:-}" ]] || return 0
      got=$(psql "$DATABASE_URL" -At -c "select assigned_user_id from public.jobs where client_name = 'Maestro Reassign' and company_id = '${MAESTRO_COMPANY_ID}'")
      if [[ "$got" == "$MAESTRO_MANAGER_ID" ]]; then echo "server: Maestro Reassign is assigned to the manager ✔"; else echo "server: Maestro Reassign assigned_user_id is '$got' (expected $MAESTRO_MANAGER_ID) ✘"; return 1; fi ;;
    04-offline-status-sync)
      got=$(psql "$DATABASE_URL" -At -c "select status from public.jobs where client_name = 'Maestro Offline' and company_id = '${MAESTRO_COMPANY_ID}'")
      if [[ "$got" == "accepted" ]]; then echo "server: Maestro Offline is accepted ✔"; else echo "server: Maestro Offline is '$got' (expected accepted) ✘"; return 1; fi ;;
  esac
}

status=0
for f in "${flows[@]}"; do
  echo "=== $f"
  ./fixtures/reset.sh
  [[ -n "${DEV_CLIENT_URL:-}" ]] && prepare_dev_client
  maestro test "$f.yaml" --test-output-dir "$OUT/$f" \
    -e TECH_EMAIL="$TECH_EMAIL" -e TECH_PASSWORD="$TECH_PASSWORD" -e OWNER_EMAIL="$OWNER_EMAIL" -e OWNER_PASSWORD="$OWNER_PASSWORD" \
    -e TECH_NAME="$TECH_NAME" -e MANAGER_NAME="$MANAGER_NAME" -e DEV_CLIENT_URL="${DEV_CLIENT_URL:-}" || status=1
  check_server "$f" || status=1
done

exit $status
