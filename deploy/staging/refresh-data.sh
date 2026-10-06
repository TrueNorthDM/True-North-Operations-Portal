#!/usr/bin/env bash
# Give staging a fresh copy of production's data (deploy/README.md, Staging).
# Run as root on the server:
#
#   /opt/tnportal/app/deploy/staging/refresh-data.sh          last night's backup
#   /opt/tnportal/app/deploy/staging/refresh-data.sh --now    a backup taken now
#
# The copy is the nightly exact copy of the database (base-*.tar.gz), restored
# into staging's own database, plus the uploaded files. Everything on staging is
# replaced; production is only read. Staging keeps its own sign-in keys, so the
# copied JWT setting is pointed at staging's secret afterwards.
set -euo pipefail

S=/opt/tnportal/supabase-staging
BACKUPS=/home/tnportal/portal-backups
SERVICES="db auth rest storage imgproxy meta studio api-gw"

[ "${1:-}" = "--now" ] && /opt/tnportal/bin/backup.sh
BASE="$(ls -t "$BACKUPS"/base-*.tar.gz | head -1)"
echo "Copying $(basename "$BASE") into staging"

cd "$S"
docker compose stop $SERVICES >/dev/null 2>&1 || true

rm -rf volumes/db/data
mkdir -p volumes/db/data
tar -xzf "$BASE" -C volumes/db/data
chown -R 100:101 volumes/db/data
chmod 700 volumes/db/data

# The uploaded files (avatars, person files).
rsync -a --delete /opt/tnportal/supabase/volumes/storage/ volumes/storage/

docker compose up -d $SERVICES >/dev/null
for _ in $(seq 1 60); do
  docker exec staging-supabase-db pg_isready -U postgres -h /var/run/postgresql >/dev/null 2>&1 && break
  sleep 2
done

JWT_SECRET="$(sed -n 's/^JWT_SECRET=//p' .env)"
docker exec -i staging-supabase-db psql -U supabase_admin -h /var/run/postgresql -d postgres -v ON_ERROR_STOP=1 -q \
  -c "ALTER DATABASE postgres SET \"app.settings.jwt_secret\" TO '$JWT_SECRET'" >/dev/null
docker compose restart auth rest storage >/dev/null

echo "Staging now holds production's data as of $(basename "$BASE" .tar.gz | sed 's/^base-//')."
