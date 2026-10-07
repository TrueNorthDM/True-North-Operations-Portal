#!/usr/bin/env bash
# The database gate (deploy/README.md, "Database gate"). Run as root:
#
#   db-gate.sh <production|staging> key   put a key in the env file (once)
#   db-gate.sh <production|staging> on    close tables and private files to
#                                         every request without the key
#   db-gate.sh <production|staging> off   open them again (the rollback)
#
# Order: "key", then a deploy so the running portal has it, then "on". "on"
# refuses while the running portal does not carry the same key or its build
# does not send it, because the gate would shut the portal out of its data,
# and checks itself from outside afterwards, putting the file back on failure.
# The key is never printed.
set -euo pipefail

ENVIRONMENT="${1:-}"; ACTION="${2:-}"
case "$ENVIRONMENT" in
  production) ENV_FILE=/opt/tnportal/portal.env;  CONTAINER=tnportal-portal;  HOST=db.truenorthportal.online ;;
  staging)    ENV_FILE=/opt/tnportal/staging.env; CONTAINER=tnportal-staging; HOST=staging.truenorthportal.online ;;
  *) echo "Usage: $0 <production|staging> <key|on|off>" >&2; exit 2 ;;
esac

HTACCESS=/home/tnportal/$HOST/.htaccess
BEGIN='# BEGIN database gate (deploy/portal/db-gate.sh)'
END='# END database gate'

file_key() { sed -n 's/^SUPABASE_GATE_KEY=//p' "$ENV_FILE" | tail -1; }

strip_block() {
  # Everything outside the markers, so "on" twice leaves one block.
  awk -v b="$BEGIN" -v e="$END" '$0==b{skip=1;next} $0==e{skip=0;next} !skip' "$HTACCESS"
}

case "$ACTION" in
  key)
    if [ -n "$(file_key)" ]; then echo "$ENV_FILE already has a key"; exit 0; fi
    cp -p "$ENV_FILE" "$ENV_FILE.before-gate-$(date +%F)"
    printf '\n# Database gate (deploy/portal/db-gate.sh): sent by the portal to the API.\nSUPABASE_GATE_KEY=%s\n' "$(openssl rand -hex 32)" >> "$ENV_FILE"
    echo "Key added to $ENV_FILE. Deploy or restart the $ENVIRONMENT portal, then run: $0 $ENVIRONMENT on"
    ;;
  on)
    KEY="$(file_key)"
    [ -n "$KEY" ] || { echo "No key in $ENV_FILE: run '$0 $ENVIRONMENT key' first" >&2; exit 1; }
    [[ "$KEY" =~ ^[0-9a-f]{64}$ ]] || { echo "The key in $ENV_FILE is not 64 hex characters" >&2; exit 1; }
    RUNNING="$(docker exec "$CONTAINER" printenv SUPABASE_GATE_KEY 2>/dev/null || true)"
    [ "$RUNNING" = "$KEY" ] || { echo "The running $CONTAINER does not carry the key yet: deploy it first" >&2; exit 1; }
    # The setting is not enough: a build from before lib/supabase/gate.ts has
    # the key and never sends it, and the gate would shut it out of its data.
    docker exec "$CONTAINER" grep -rqs x-portal-key /app/.next/server \
      || { echo "The build $CONTAINER runs does not send the key (older than the gate): deploy a newer commit first" >&2; exit 1; }
    [ -f "$HTACCESS.before-gate" ] || cp -p "$HTACCESS" "$HTACCESS.before-gate"
    BLOCK_FILE="$(mktemp)"
    {
      echo "$BEGIN"
      echo "# Tables, and files that are not public or signed, answer only the portal's"
      echo "# own server, which sends this key. Sign-in, public files and signed links stay open."
      echo "RewriteCond %{HTTP:X-Portal-Key} !^${KEY}\$"
      echo "RewriteRule ^(rest|graphql|realtime|pg|functions)/ - [F,L]"
      echo "RewriteCond %{HTTP:X-Portal-Key} !^${KEY}\$"
      echo "RewriteCond %{REQUEST_URI} !^/storage/v1/object/(public|sign)/"
      echo "RewriteRule ^storage/ - [F,L]"
      echo "# Public files and signed links are read, never made: a POST to /object/sign"
      echo "# would create a link to any private file the session's row rules allow."
      echo "RewriteCond %{HTTP:X-Portal-Key} !^${KEY}\$"
      echo "RewriteCond %{REQUEST_METHOD} !^(GET|HEAD)\$"
      echo "RewriteRule ^storage/ - [F,L]"
      echo "$END"
    } > "$BLOCK_FILE"
    # The gate goes straight after "RewriteEngine On", ahead of every other
    # rule, so it can never come between a RewriteCond and the rule it belongs to.
    strip_block | awk -v bf="$BLOCK_FILE" '{print} !done && /^[[:space:]]*RewriteEngine[[:space:]]+On/ {while ((getline l < bf) > 0) print l; done=1}' > "$HTACCESS.new"
    rm -f "$BLOCK_FILE"
    grep -qF "$BEGIN" "$HTACCESS.new" || { rm -f "$HTACCESS.new"; echo "No RewriteEngine On line in $HTACCESS" >&2; exit 1; }
    chown --reference="$HTACCESS" "$HTACCESS.new"; chmod --reference="$HTACCESS" "$HTACCESS.new"
    cp -p "$HTACCESS" "$HTACCESS.before-on"
    mv "$HTACCESS.new" "$HTACCESS"

    # Prove it from outside, through Cloudflare: without the key the gate
    # answers 403; with it the request reaches Supabase, whose gateway answers
    # 401 to a call with no API key. Anything else puts the file back.
    sleep 2
    code() { curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$@" "https://$HOST/rest/v1/"; }
    WITHOUT="$(code)"; WITH="$(code -H "X-Portal-Key: $KEY")"
    if [ "$WITHOUT" != 403 ] || [ "$WITH" = 403 ] || [ "$WITH" = 000 ]; then
      mv "$HTACCESS.before-on" "$HTACCESS"
      echo "Gate check failed (without key: $WITHOUT, with key: $WITH). Put the previous file back." >&2
      exit 1
    fi
    rm -f "$HTACCESS.before-on"
    echo "Gate on for $ENVIRONMENT (without key: $WITHOUT, with key: $WITH)"
    ;;
  off)
    strip_block > "$HTACCESS.new"
    chown --reference="$HTACCESS" "$HTACCESS.new"; chmod --reference="$HTACCESS" "$HTACCESS.new"
    mv "$HTACCESS.new" "$HTACCESS"
    echo "Gate off for $ENVIRONMENT"
    ;;
  *) echo "Usage: $0 <production|staging> <key|on|off>" >&2; exit 2 ;;
esac
