#!/usr/bin/env bash
# Copy the portal's data from Supabase cloud into this server (migration plan:
# the rehearsal p5-copy, and p6-copy on the day). Run as root on the server:
#
#   copy.sh --reset     start from an empty database (the rehearsals, and the day)
#   copy.sh             copy into the database as it is (it must still be empty)
#
# It only reads from the cloud. Access comes from /opt/tnportal/secrets/cloud.env
# (set-cloud-secrets.sh). Each step is timed; the times are the rehearsal's p5-time.
#
#  1. Extensions and roles the cloud has and this server lacks.
#  2. The portal's schema (public, and any other schema of its own): tables,
#     functions, views, policies, grants.
#  3. What lives on Supabase's own tables: the triggers on auth.users (the
#     invitation rule, the account-to-person link) and the policies on storage.
#  4. The data: the portal's tables, and the sign-in accounts with their
#     identities and two-step factors. Sessions are not copied: everyone signs
#     in again at the new address.
#  5. The files, bucket by bucket, through both storage APIs (copy-storage.mjs).
#  6. The comparison, table by table (compare.sh).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SUPA=/opt/tnportal/supabase
source "$HERE/lib.sh"

WORK="/opt/tnportal/migrate/$(date -u +%Y%m%dT%H%MZ)"
install -d -m 700 "$WORK"
LOG="$WORK/copy.log"
exec > >(tee -a "$LOG") 2>&1

step_start=0
step() { step_start=$SECONDS; echo; echo "== $*"; }
took() { echo "   ($((SECONDS - step_start)) s)"; }

echo "Copy started $(date -u +%Y-%m-%dT%H:%M:%SZ). Log: $LOG"
total_start=$SECONDS

if [ "${1:-}" = "--reset" ]; then
  step "0. Reset: an empty database and empty file storage"
  "$HERE/reset.sh"
  took
fi

step "Checks"
echo "   cloud:  Postgres $(echo 'show server_version' | src)"
echo "   server: Postgres $(echo 'show server_version' | dst)"
tables="$(echo "select count(*) from pg_tables where schemaname='public'" | dst)"
[ "$tables" = 0 ] || { echo "The server's public schema already has $tables tables. Use --reset." >&2; exit 1; }
users="$(echo 'select count(*) from auth.users' | dst)"
[ "$users" = 0 ] || { echo "The server already has $users sign-in accounts. Use --reset." >&2; exit 1; }
SCHEMAS="$(echo "select string_agg(nspname, ' ' order by nspname) from pg_namespace where nspname not in ($MANAGED) and nspname not like 'pg\_%'" | src)"
echo "   the portal's schemas: $SCHEMAS"
took

step "1. Extensions and roles"
echo "select e.extname || ' ' || n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace order by 1" | src > "$WORK/cloud-extensions.txt"
echo "select extname from pg_extension" | dst > "$WORK/server-extensions.txt"
while read -r ext ns; do
  grep -qx "$ext" "$WORK/server-extensions.txt" && continue
  echo "   creating extension $ext (schema $ns)"
  printf 'create schema if not exists "%s"; create extension if not exists "%s" with schema "%s";\n' "$ns" "$ext" "$ns" | dst \
    || echo "   WARNING: could not create extension $ext"
done < "$WORK/cloud-extensions.txt"
echo "select rolname from pg_roles" | src | LC_ALL=C sort > "$WORK/cloud-roles.txt"
echo "select rolname from pg_roles" | dst | LC_ALL=C sort > "$WORK/server-roles.txt"
missing_roles="$(LC_ALL=C comm -23 "$WORK/cloud-roles.txt" "$WORK/server-roles.txt" | grep -v '^pg_' || true)"
for r in $missing_roles; do
  echo "   creating role $r (no login)"
  printf 'create role "%s" nologin;\n' "$r" | dst || echo "   WARNING: could not create role $r"
done
[ -n "$missing_roles" ] || echo "   no roles to add"
took

step "2. The portal's schema"
args=(--schema-only --no-publications --no-subscriptions --quote-all-identifiers)
for s in $SCHEMAS; do args+=(--schema="$s"); done
src_dump "${args[@]}" > "$WORK/schema.sql"
# The public schema already exists here, with Supabase's own settings.
sed -i -E '/^CREATE SCHEMA "public";$/d; /^COMMENT ON SCHEMA "public" IS/d; /^ALTER SCHEMA "public" OWNER TO/d' "$WORK/schema.sql"
echo "   $(grep -c '^CREATE TABLE' "$WORK/schema.sql") tables, $(grep -c '^CREATE FUNCTION\|^CREATE OR REPLACE FUNCTION' "$WORK/schema.sql") functions, $(grep -c '^CREATE POLICY' "$WORK/schema.sql") policies"
dst -1 -q < "$WORK/schema.sql" > /dev/null
took

step "3. Triggers on auth and storage, and storage policies"
cat > "$WORK/extra.sql.in" <<'SQL'
select format('%s;', pg_get_triggerdef(t.oid)) || chr(9) || n.nspname || '.' || c.relname || '.' || t.tgname
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal and n.nspname in ('auth', 'storage')
union all
select format('create policy %I on %I.%I as %s for %s to %s%s%s;',
         policyname, schemaname, tablename, permissive, cmd,
         (select string_agg(quote_ident(r), ', ') from unnest(roles) r),
         coalesce(' using (' || qual || ')', ''),
         coalesce(' with check (' || with_check || ')', ''))
       || chr(9) || schemaname || '.' || tablename || '.' || policyname
from pg_policies where schemaname in ('auth', 'storage')
order by 1
SQL
src < "$WORK/extra.sql.in" > "$WORK/cloud-extra.tsv"
dst < "$WORK/extra.sql.in" | cut -f2 > "$WORK/server-extra.txt"
added=0; failed=0
while IFS=$'\t' read -r sql name; do
  grep -qx "$name" "$WORK/server-extra.txt" && continue
  if printf '%s\n' "$sql" | dst -q > /dev/null 2>> "$WORK/extra-errors.txt"; then
    echo "   added $name"; added=$((added + 1))
  else
    echo "   WARNING: could not add $name (see extra-errors.txt)"; failed=$((failed + 1))
  fi
done < "$WORK/cloud-extra.tsv"
echo "   $added added, $failed warnings"
took

step "4. The data"
# The sign-in tables both sides have. Supabase cloud runs a newer sign-in
# service than the image here, with tables this one does not know (on
# 5 October 2026: MFA recovery codes and SCIM, all empty); copying them would
# stop the load. Their rows are counted and named, so a table left behind that
# holds data is seen, not lost in silence.
AUTH_Q="select table_name from information_schema.tables where table_schema = 'auth' and table_type = 'BASE TABLE'"
echo "$AUTH_Q" | src | LC_ALL=C sort > "$WORK/cloud-auth-tables.txt"
echo "$AUTH_Q" | dst | LC_ALL=C sort > "$WORK/server-auth-tables.txt"
for t in $(LC_ALL=C comm -23 "$WORK/cloud-auth-tables.txt" "$WORK/server-auth-tables.txt"); do
  echo "   auth.$t is not on this server: $(echo "select count(*) from auth.\"$t\"" | src) rows left behind"
done
# Sign-in history and live sessions stay behind; everyone signs in again.
SKIP_AUTH=" schema_migrations sessions refresh_tokens mfa_challenges mfa_amr_claims flow_state one_time_tokens audit_log_entries saml_relay_states oauth_authorizations oauth_consents "
# --table, not --schema: pg_dump ignores --schema once any --table is given.
dargs=(--data-only --quote-all-identifiers)
for s in $SCHEMAS; do dargs+=(--table="$s.*"); done
for t in $(LC_ALL=C comm -12 "$WORK/cloud-auth-tables.txt" "$WORK/server-auth-tables.txt"); do
  [[ "$SKIP_AUTH" == *" $t "* ]] || dargs+=(--table="auth.$t")
done
src_dump "${dargs[@]}" > "$WORK/data.sql"
echo "   $(du -h "$WORK/data.sql" | cut -f1) of data"
# Triggers off while loading (the rows were already checked in the cloud), all in one transaction.
{ echo "SET session_replication_role = replica;"; cat "$WORK/data.sql"; } | dst -1 -q > /dev/null
echo "NOTIFY pgrst, 'reload schema';" | dst -q > /dev/null
took

step "5. The files"
if [ "${SKIP_FILES:-}" = 1 ]; then
  echo "   skipped (SKIP_FILES=1, a test without the cloud's storage)"
else
  LOCAL_SERVICE_KEY="$(grep '^SERVICE_ROLE_KEY=' "$SUPA/.env" | cut -d= -f2-)"
  docker run --rm --network host \
    -e CLOUD_SUPABASE_URL="$CLOUD_SUPABASE_URL" -e CLOUD_SERVICE_KEY="$CLOUD_SERVICE_KEY" \
    -e LOCAL_URL=http://127.0.0.1:8000 -e LOCAL_SERVICE_KEY="$LOCAL_SERVICE_KEY" \
    -v "$HERE/copy-storage.mjs:/copy-storage.mjs:ro" \
    node:22-alpine node /copy-storage.mjs
fi
took

step "6. Comparison"
"$HERE/compare.sh" | tee "$WORK/compare.txt"
took

echo
echo "Copy finished in $((SECONDS - total_start)) s. Files: $WORK"
