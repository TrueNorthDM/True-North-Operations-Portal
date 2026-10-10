#!/usr/bin/env bash
# Call one scheduled job on the portal running on this machine, the way Vercel
# Cron did: a GET with "Authorization: Bearer $CRON_SECRET". Used by
# portal.crontab. The secret and the port come from the portal's environment
# file, never from this repository.
#
#   run.sh /api/cron/ingest
set -euo pipefail

job="${1:?usage: run.sh /api/cron/<job>}"
env_file="${PORTAL_ENV:-/opt/tnportal/portal.env}"
log_dir="${PORTAL_LOG_DIR:-/opt/tnportal/logs}"

# shellcheck disable=SC1090
source "$env_file"
mkdir -p "$log_dir"

stamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
# The header goes in on stdin, not on the command line, where any user of the
# machine could read the secret with ps (audit, 10 October 2026).
if out="$(printf 'Authorization: Bearer %s\n' "${CRON_SECRET:?CRON_SECRET missing in $env_file}" | curl -fsS --max-time 300 -H @- "http://127.0.0.1:${PORT:-3000}${job}" 2>&1)"; then
  echo "$stamp ok   $job ${out:0:300}" >> "$log_dir/cron.log"
else
  echo "$stamp FAIL $job ${out:0:300}" >> "$log_dir/cron.log"
  exit 1
fi
