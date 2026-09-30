#!/usr/bin/env bash
# Row counts, the cloud against this server (migration plan: p5-compare and
# p6-counts): every table of the portal, the sign-in accounts with their
# identities and two-step factors, and the files in each bucket.
# Prints one line per table and exits 1 if any count differs.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/lib.sh"

Q="
select format('%s.%s', n.nspname, c.relname) || chr(9) ||
       (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p')
  and ((n.nspname not in ($MANAGED) and n.nspname not like 'pg\_%')
       or (n.nspname = 'auth' and c.relname in ('users', 'identities', 'mfa_factors')))
union all
select 'storage.objects[' || bucket_id || ']' || chr(9) || count(*) from storage.objects group by bucket_id
order by 1"

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
echo "$Q" | src | sort > "$tmp/cloud"
echo "$Q" | dst | sort > "$tmp/server"

diffs=0; total=0
printf '%-52s %12s %12s\n' "table" "cloud" "server"
while IFS=$'\t' read -r name cloud server; do
  total=$((total + 1))
  mark=""; [ "$cloud" = "$server" ] || { mark="  <-- DIFFERENT"; diffs=$((diffs + 1)); }
  printf '%-52s %12s %12s%s\n' "$name" "$cloud" "$server" "$mark"
done < <(join -t $'\t' -a1 -a2 -e missing -o 0,1.2,2.2 "$tmp/cloud" "$tmp/server")

echo
if [ "$diffs" = 0 ]; then echo "All $total counts match."; else echo "$diffs of $total counts differ."; exit 1; fi
