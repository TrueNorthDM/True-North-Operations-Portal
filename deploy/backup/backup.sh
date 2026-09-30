#!/usr/bin/env bash
# Nightly backup of the portal's own server (migration plan, step p3-backup).
#
#   base-*.tar.gz     An exact copy of the database files (pg_basebackup), the
#                     one to restore from: every role, the auth users and their
#                     two-step factors, the portal's data. Kept 14 days.
#   db-*.sql.gz       The same database as SQL (pg_dumpall), readable and good
#                     for pulling a single table back. Kept 30 days.
#   storage-*.tar.gz  The files people uploaded (avatars, attachments). Kept 30 days.
#
# Restoring base-*: stop the db container, replace volumes/db/data with the
# unpacked archive (owner 100:101, mode 700), start it again. It must go back
# into the same Postgres major version (17). See deploy/README.md.
#
# Runs as root from /etc/cron.d/tnportal-backup (deploy/backup/tnportal-backup.cron),
# so it can read every file the storage service writes.
set -euo pipefail

DIR=/opt/tnportal/backups
LOG=/opt/tnportal/logs/backup.log
stamp="$(date -u +%Y-%m-%dT%H%MZ)"
mkdir -p "$DIR"
cd "$DIR"
umask 077

log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $*" >> "$LOG"; }
fail() { rm -f "$DIR"/*.part; log "FAIL $1"; exit 1; }

# 1. Exact copy, through the container's own socket (deploy/supabase/pg_hba.conf).
base="base-$stamp.tar.gz"
docker exec supabase-db pg_basebackup -U supabase_admin -h /var/run/postgresql -D - -Ft -X fetch -z > "$base.part" \
  && gzip -t "$base.part" || fail "base"
mv "$base.part" "$base"; log "ok   base     $(du -h "$base" | cut -f1) $base"

# 2. The same as SQL.
db="db-$stamp.sql.gz"
{ docker exec supabase-db pg_dumpall -U supabase_admin --clean --if-exists | gzip -6 > "$db.part"; } \
  && gzip -t "$db.part" \
  && zcat "$db.part" | tail -n 5 | grep -q "PostgreSQL database cluster dump complete" || fail "database"
mv "$db.part" "$db"; log "ok   database $(du -h "$db" | cut -f1) $db"

# 3. Uploaded files.
files="storage-$stamp.tar.gz"
tar -C /opt/tnportal/supabase/volumes -czf "$files.part" storage || fail "storage"
mv "$files.part" "$files"; log "ok   storage  $(du -h "$files" | cut -f1) $files"

find "$DIR" -name 'base-*.tar.gz' -mtime +14 -delete
find "$DIR" -name 'db-*.sql.gz' -mtime +30 -delete
find "$DIR" -name 'storage-*.tar.gz' -mtime +30 -delete
