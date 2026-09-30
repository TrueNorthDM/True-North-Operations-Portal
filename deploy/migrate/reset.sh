#!/usr/bin/env bash
# An empty database and empty file storage for the copy (copy.sh --reset).
# The current database files are set aside in /opt/tnportal/migrate (only the
# latest set is kept), then Supabase starts from scratch and its services
# create their own tables again.
set -euo pipefail
cd /opt/tnportal/supabase
stamp="$(date -u +%Y%m%dT%H%MZ)"
SERVICES="db auth rest storage imgproxy meta studio api-gw"

sudo -u portal docker compose stop $SERVICES >/dev/null 2>&1
sudo -u portal docker compose rm -f $SERVICES >/dev/null 2>&1
install -d -m 700 /opt/tnportal/migrate
rm -rf /opt/tnportal/migrate/before-*
mkdir -p "/opt/tnportal/migrate/before-$stamp"
mv volumes/db/data "/opt/tnportal/migrate/before-$stamp/db-data"
mv volumes/storage "/opt/tnportal/migrate/before-$stamp/storage"
install -d -o 100 -g 101 -m 700 volumes/db/data
install -d -o portal -g portal -m 755 volumes/storage

sudo -u portal /opt/tnportal/bin/supabase.sh up >/dev/null 2>&1
for _ in $(seq 1 60); do
  healthy="$(docker ps --filter health=healthy --filter name=supabase- -q | wc -l)"
  [ "$healthy" -ge 8 ] && { echo "   Supabase is back, empty ($healthy services healthy)."; exit 0; }
  sleep 3
done
echo "Supabase did not come back healthy after the reset." >&2
docker ps --format '{{.Names}}: {{.Status}}' >&2
exit 1
