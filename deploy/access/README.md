# Promoting the access model to production

The access model of 7 October 2026 (`docs/access/01-design.md`) changes the
database in two steps around the code, and adds the database gate
(`deploy/README.md`, "Database gate"). Staging has all of it. This is the order
for production, as root on the server, from `/opt/tnportal/app`. `<sha>` is the commit being promoted;
`<prev>` the one production runs now (`docker inspect --format '{{.Config.Image}}' tnportal-portal`).

| # | Step | Command |
|---|---|---|
| 1 | Backup on the spot | `/opt/tnportal/app/deploy/backup/backup.sh` |
| 2 | Migration 094 (additive: new tables and columns; the old code ignores them) | `docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/migrations/094_access_model.sql` |
| 3 | Gate key in `portal.env` | `deploy/portal/db-gate.sh production key` |
| 4 | Promote | Actions, "Promote to production", `<sha>` (or `deploy.sh <sha> production` as `portal`) |
| 5 | Gate on (checks itself; puts the file back if the check fails) | `deploy/portal/db-gate.sh production on` |
| 6 | Snapshot what 095 rewrites | `docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < deploy/access/095-snapshot.sql` |
| 7 | Migration 095 (positions Lead and Member, roles follow the levels) | as step 2, with `095_access_positions_and_roles.sql` |
| 8 | Smoke test | below |

Steps 2 to 7 take a few minutes; nobody is locked out between them: the new
code reads the old position words, and the gate goes on only once the portal
carries its key.

## Smoke test

- From outside: `https://db.truenorthportal.online/rest/v1/` answers 403;
  an avatar under `/storage/v1/object/public/` still loads.
- Signed in as a Super Admin: Home, Directory (all six tabs), Admin > Access
  levels (five tabs, the eye on each column), Company settings (six sections),
  the i7 report and its PDF, Project Hours, Report, My Work.
- View Stage as Team Leader and as User: the rail matches the Access page's
  preview; the i7 report shows no budget panel and no history; Directory shows
  the restricted list.
- `docker logs tnportal-portal --since 10m` has no "Could not read the access
  rules" and no 403 from the database.
- The health job: `sudo -u portal /opt/tnportal/app/deploy/cron/run.sh /api/cron/health` answers ok.

## Rollback

Decide before starting: roll back if signing in fails, if a Super Admin cannot
open a page they could before, or if any page shows a database error.

- **Before step 7**: `deploy/portal/db-gate.sh production off`, then promote
  `<prev>`. 094 stays: it only added tables the old code does not read.
- **After step 7**: as above, then put 095's changes back with
  `docker exec -i supabase-db psql -U postgres -d postgres < deploy/access/095-restore.sql`
  (one transaction, from step 6's snapshot; tested on staging inside a rolled
  back transaction on 7 October 2026).
- **Only the gate misbehaves**: `deploy/portal/db-gate.sh production off`;
  nothing else needs to move.
- Last resort: the backup from step 1 (`deploy/README.md`, Backups).

After a week without a rollback: `DROP SCHEMA undo_095 CASCADE;`.
