#!/usr/bin/env bash
# Regenerate src/lib/types/database.generated.ts from the production schema.
#
# Run after every migration that changes tables, columns or functions:
#
#   deploy/db/gen-types.sh
#
# It asks the stack's own postgres-meta (the generator Supabase's CLI uses) on
# the server over SSH, so nothing extra is installed here. Only the schema is
# read, never a row. Then run the type check: a column that changed shows up
# wherever the code still assumes the old shape.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/src/lib/types/database.generated.ts"
SSH=(ssh -F /dev/null -i "$HOME/.ssh/truenorth_vps" -o IdentitiesOnly=yes -p 6543 root@174.136.29.221)

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

"${SSH[@]}" 'docker exec supabase-meta node -e "fetch(\"http://localhost:8080/generators/typescript?included_schemas=public\").then(r => { if (!r.ok) throw new Error(r.status); return r.text() }).then(t => process.stdout.write(t))"' > "$TMP"

# A real answer starts with the Json type; anything else is an error page.
if ! head -1 "$TMP" | grep -q '^export type Json'; then
  echo "The generator did not answer with types:" >&2
  head -5 "$TMP" >&2
  exit 1
fi

{
  echo '// GENERATED from the production schema by deploy/db/gen-types.sh. Do not edit by'
  echo '// hand: change the database with a migration, then run the script again.'
  echo '// Hand-made refinements (JSON shapes, value unions) live in database.types.ts.'
  echo
  cat "$TMP"
} > "$OUT"

echo "Wrote $OUT ($(wc -l < "$OUT" | tr -d ' ') lines). Now run the type check."
