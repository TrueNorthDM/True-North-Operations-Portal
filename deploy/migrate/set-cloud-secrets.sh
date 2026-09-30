#!/usr/bin/env bash
# Save read access to the portal's Supabase cloud project on this server, for
# the data copy (copy.sh). Run by Arnaldo's one-line command from his Mac:
# stdin carries two lines, the database password and the service role key,
# so neither is typed into a chat or shown on screen.
#
#   set-cloud-secrets.sh "postgresql://postgres.<ref>:[YOUR-PASSWORD]@<host>:5432/postgres"
#
# Writes /opt/tnportal/secrets/cloud.env (root only) and tests both.
set -euo pipefail

template="${1:?usage: set-cloud-secrets.sh <Session pooler URI with [YOUR-PASSWORD]>}"
IFS= read -r password
IFS= read -r service_key
[ -n "$password" ] || { echo "No password received." >&2; exit 1; }
[[ "$template" == *"[YOUR-PASSWORD]"* ]] || { echo "The address must still contain [YOUR-PASSWORD]." >&2; exit 1; }

# The project ref is the part after "postgres." in the user name.
ref="$(sed -E 's|^postgres(ql)?://postgres\.([a-z0-9]+):.*|\2|' <<<"$template")"
[[ "$ref" =~ ^[a-z0-9]{20}$ ]] || { echo "Could not read the project ref from the address." >&2; exit 1; }

encoded="$(printf '%s' "$password" | /usr/libexec/platform-python -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.stdin.read(), safe=""))')"
url="${template/\[YOUR-PASSWORD\]/$encoded}"

install -d -m 700 /opt/tnportal/secrets
umask 077
{
  echo "# Supabase cloud (the portal before the move), read by deploy/migrate/copy.sh."
  echo "CLOUD_DB_URL='$url'"
  echo "CLOUD_SUPABASE_URL='https://$ref.supabase.co'"
  echo "CLOUD_SERVICE_KEY='$service_key'"
} > /opt/tnportal/secrets/cloud.env

# Both checks read only.
if docker exec -e PGURL="$url" supabase-db sh -c 'psql "$PGURL" -X -At -c "select current_setting('"'"'server_version'"'"')"' >/tmp/cloud-pg.$$ 2>&1; then
  echo "Database: connected (Postgres $(cat /tmp/cloud-pg.$$))."
else
  echo "Database: could not connect: $(tail -1 /tmp/cloud-pg.$$)" >&2
fi
rm -f /tmp/cloud-pg.$$
code="$(curl -s -o /dev/null -w '%{http_code}' -H "apikey: $service_key" -H "Authorization: Bearer $service_key" "https://$ref.supabase.co/storage/v1/bucket")"
if [ "$code" = 200 ]; then echo "Files: connected."; else echo "Files: the service key was refused ($code)." >&2; fi
