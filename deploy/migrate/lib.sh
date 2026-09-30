# Shared by copy.sh and compare.sh (sourced, not run).
# CLOUD_ENV points elsewhere only for a test against a stand-in for the cloud.
# shellcheck disable=SC1090
source "${CLOUD_ENV:-/opt/tnportal/secrets/cloud.env}"
: "${CLOUD_DB_URL:?}" "${CLOUD_SUPABASE_URL:?}" "${CLOUD_SERVICE_KEY:?}"

# The cloud, read through the database container's own tools (psql and pg_dump 17).
src()      { docker exec -i -e PGURL="$CLOUD_DB_URL" supabase-db sh -c 'psql "$PGURL" -X -At -v ON_ERROR_STOP=1'; }
src_dump() { docker exec -e PGURL="$CLOUD_DB_URL" supabase-db sh -c 'pg_dump "$PGURL" "$@"' pg_dump "$@"; }
# This server, as the superuser over the container's socket.
dst()      { docker exec -i supabase-db psql -U supabase_admin -h /var/run/postgresql -d postgres -X -At -v ON_ERROR_STOP=1 "$@"; }

# Supabase's own schemas: the image and its services create them.
MANAGED="'auth','storage','extensions','graphql','graphql_public','pgbouncer','realtime','_realtime','supabase_functions','supabase_migrations','vault','pgsodium','pgsodium_masks','net','cron','_analytics','_supavisor','information_schema'"
