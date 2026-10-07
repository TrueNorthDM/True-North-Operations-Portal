# The portal's own server

The portal runs on True North's ScalaHosting VPS (SPanel, Rocky Linux 8), next to
the websites, in `/opt/tnportal`, owned by the `portal` user. Everything listens
on 127.0.0.1 only; LiteSpeed forwards the public addresses to it.

| Folder on the server | What | From |
|---|---|---|
| `/opt/tnportal/supabase` | Supabase: database, sign-in, data API, file storage, Studio (`127.0.0.1:8000`) | Supabase's official `docker/` folder, plus `deploy/supabase/` |
| `/opt/tnportal/app` | This repository, checked out read-only | GitHub, with a read-only deploy key |
| `/opt/tnportal/portal.env` | The portal's settings and secrets | Written on the server, never committed |
| `/opt/tnportal/bin` | `supabase.sh` (up, down, ps, logs), `apply-env.sh` | `deploy/supabase/` |

## Public addresses

Each address is an SPanel domain whose folder holds only an `.htaccess` that
forwards every request to the service on 127.0.0.1. SPanel's own vhost files
(`/etc/httpd/vhosts/*.conf`) are left alone; the certificates are SPanel's
Let's Encrypt ones, renewed by SPanel.

| Address | Folder | Forwards to |
|---|---|---|
| `truenorthportal.online` (and `www`, redirected to it) | `/home/tnportal/public_html` | the portal, `127.0.0.1:3000` |
| `staging.truenorthportal.online` | `/home/tnportal/staging.truenorthportal.online` | the portal, `127.0.0.1:3000` |
| `db.truenorthportal.online` | `/home/tnportal/db.truenorthportal.online` | Supabase, `127.0.0.1:8000` |

ScalaHosting set up staging and db (ticket #381626); the main domain was done
the same way on 5 October 2026 (the old file is kept beside it as
`.htaccess.before-portal-2026-10-05`). The main domain's file answers
`/.well-known/` itself, so certificate renewals never reach the portal.

## Supabase (`deploy/supabase/`)

- `docker-compose.tnportal.yml` sits beside Supabase's `docker-compose.yml`
  (`COMPOSE_FILE` in its `.env`). The portal does not use realtime, edge
  functions or the pooler, so `supabase.sh` starts only
  `db auth rest storage imgproxy meta studio api-gw`.
- Secrets were generated on the server by Supabase's `utils/generate-keys.sh`;
  `apply-env.sh` sets the non-secret values (URLs, sessions, email sender).

Two things specific to this server:

- **Docker user remapping is off.** ScalaHosting installed Docker with
  `userns-remap`, but the server's `/` is mode 711 and remapped containers and
  builds could not start ("open /: permission denied"). On 30 September 2026
  `userns-remap` was removed from `/etc/docker/daemon.json` (their original is
  `daemon.json.orig-scalahosting`). The compose files still say
  `userns_mode: host`, so the containers keep working if it is ever turned back
  on, and the database's config lives in a folder (`volumes/db/config`, owner
  100:101) instead of a named volume.
- **Root signs in by key only** (`PermitRootLogin prohibit-password` since
  30 September 2026; original `sshd_config.orig-scalahosting`). Every root
  login on record was by key (ours, ScalaHosting's support gate and their backup
  server); password logins stay allowed for the SPanel accounts' SFTP.
- **The CSF firewall** flushes Docker's iptables chains when it reloads.
  `/etc/csf/csfpost.sh` restarts Docker when they are missing, and Docker's
  `live-restore` keeps the containers running through that restart.

## The portal (`deploy/portal/`)

- `Dockerfile`: Next.js on Node 22, with Debian's Chromium for the PDF exports
  (`CHROME_PATH`).
- `restart.sh`: restart the running build, e.g. after a change to `portal.env`.
- `deploy.sh <ref> [production|staging]`: fetch, build (low CPU priority),
  swap, check `/login`, and go back to the previous build if the new one does
  not answer. Each environment has its own build, because the browser code
  carries its addresses. Keeps the build cache at 3 GB.

## Staging (`deploy/staging/`)

A second copy of the portal, with a copy of production's data, at
`https://staging.truenorthportal.online` (set up 6 October 2026). Every push to
main lands there first; production changes only when a commit is promoted.

| | Production | Staging |
|---|---|---|
| Address | truenorthportal.online | staging.truenorthportal.online |
| Portal container | `tnportal-portal`, 127.0.0.1:3000, `portal.env` | `tnportal-staging`, 127.0.0.1:3001, `staging.env` |
| Supabase | `/opt/tnportal/supabase`, project `supabase`, gateway 127.0.0.1:8000 | `/opt/tnportal/supabase-staging`, project `supabase-staging`, gateway 127.0.0.1:8001 |
| Supabase's public address | db.truenorthportal.online | the staging address itself: `/auth/v1`, `/rest/v1` and `/storage/v1` go to its gateway |
| Deploy | Actions, "Promote to production" (`deploy-server.yml`) | every push (`deploy-staging.yml`) |
| Scheduled jobs, Monday webhooks, backups, watch | yes | none |
| Emails the portal sends (invitations) | everyone | only `STAGING_EMAIL_ALLOWLIST` |

- Staging has its own sign-in keys (JWT secret, anon and service keys); its
  sign-in emails come from "True North Operations Portal (staging)". A yellow
  strip on every page says it is the test copy (`NEXT_PUBLIC_APP_ENV=staging`).
- **Fresh data:** `deploy/staging/refresh-data.sh` (as root) restores last
  night's exact copy into staging's database, with `--now` a backup taken on
  the spot. Production is only read.
- **The project name trap.** Supabase's own `docker-compose.yml` says
  `name: supabase`, so a copy of the folder joins production's project and
  replaces its containers. Staging's copy says `name: supabase-staging`; keep it
  that way. (On 6 October 2026 the first start took production's database and
  sign-in down for about 3 minutes before this was caught.)
- **Database changes** (migrations) go to staging first, and to production when
  the commit is promoted.

## Moving the data (`deploy/migrate/`)

The copy from Supabase cloud to this server, and the table-by-table comparison:
see `deploy/migrate/README.md`. The day itself is `deploy/SWITCH-OVER.md`.

## Scheduled jobs (`deploy/cron/`)

`portal.crontab` for the `portal` user; `run.sh` calls each job on
`127.0.0.1:3000` with `CRON_SECRET`. The six jobs and their times live only here
(the daily summary emails run every 15 minutes; most runs find nothing to do).

## Backups (`deploy/backup/`)

`backup.sh` runs every night at 03:30 server time (`/etc/cron.d/tnportal-backup`,
as root) and writes to `/home/tnportal/portal-backups` (root only). It is under
`/home` because ScalaHosting's daily backups cover `/home` and not `/opt`, so
every night's files also leave the server with theirs:

- `base-*.tar.gz`: an exact copy of the database files (pg_basebackup), kept
  14 days. This is the one to restore from.
- `db-*.sql.gz`: the same database as SQL (pg_dumpall), kept 30 days.
- `storage-*.tar.gz`: the uploaded files, kept 30 days.

The exact copy goes through the container's own socket; `deploy/supabase/pg_hba.conf`
is the image's file with one added line allowing that. To restore: stop the db
container, replace `supabase/volumes/db/data` with the unpacked `base-*` archive
(owner 100:101, mode 700), start it. Tested on 30 September 2026 in a throwaway
container: the same roles and tables as the live database. Tested again with the
real data on 5 October 2026, after the switch-over: 94 tables and 239,708 rows,
every table's count identical to the live database.

Log: `/opt/tnportal/logs/backup.log`.

## Supabase Studio (the database panel)

Closed on the public address: `db.truenorthportal.online/` answers 403 even with
the right password (`deploy/supabase/close-studio.py`, re-applied by
`apply-env.sh`). It listens on the server itself, `127.0.0.1:3010`. To open it
from Arnaldo's Mac, keep this running in a Terminal and go to
http://localhost:3010:

    ssh -F /dev/null -i ~/.ssh/truenorth_vps -o IdentitiesOnly=yes -p 6543 -N -L 3010:127.0.0.1:3010 root@174.136.29.221

## The watch (`deploy/watch/`)

`watch.py` runs every 10 minutes (`/etc/cron.d/tnportal-watch`, as root) and
emails arnaldo.oliveira@me.com through Resend when a problem appears and when
it clears: a service down or unhealthy, the portal or sign-in not answering,
less than 10 GB free, or no good nightly backup in 26 hours. State:
`/opt/tnportal/watch/state.json`; log: `/opt/tnportal/logs/watch.log`.
`watch.py --test` sends one email to check the path.
