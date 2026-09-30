# Copying the portal's data from Supabase cloud to the server

Used for the rehearsal (phase 5: `p5-copy`, `p5-compare`, `p5-time`) and on
switch-over day (phase 6: `p6-copy`, `p6-counts`). Everything runs as root on
the server, from `/opt/tnportal/app/deploy/migrate`. It only ever reads from
the cloud.

| Script | What it does |
|---|---|
| `set-cloud-secrets.sh` | Saves read access to the cloud in `/opt/tnportal/secrets/cloud.env` (root only) and tests it. Arnaldo runs it from his Mac with one command: the database password is typed into his Terminal and the service key is read from his `.env.local`, so neither passes through a chat. |
| `copy.sh --reset` | Empties the server's database and file storage (`reset.sh`), then copies: extensions and roles, the portal's schema, the triggers on `auth.users` and the policies on storage, the data (with the sign-in accounts and two-step factors, not the sessions), the files (`copy-storage.mjs`), and compares. Each step is timed. Work files and the log go to `/opt/tnportal/migrate/<time>/`. |
| `compare.sh` | Row counts, cloud against server, for every table of the portal, the accounts, identities, two-step factors and files per bucket. Exits 1 on any difference. |

## Why the copy reads the cloud and not `supabase/migrations`

On 30 September 2026 the 92 migrations were applied, in order, to an empty
copy of the server's database: 10 failed. The live database has things no
migration creates (the `app_settings` table, the trigger that runs
`enforce_email_domain` on `auth.users`), and `078` has a syntax error that was
fixed by hand when it ran. So the copy takes the schema from the cloud itself
(`pg_dump --schema-only`), and after the move the migrations folder should get
one baseline taken from the server.

## Tested

Against a stand-in for the cloud (the server's own database with the 82
migrations that apply, one account with a two-step factor): the whole copy ran
in 31 s and all 59 counts matched; the authenticator secret arrived intact.
The file copy needs the real cloud and is first run in the rehearsal.
