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
- **The CSF firewall** flushes Docker's iptables chains when it reloads.
  `/etc/csf/csfpost.sh` restarts Docker when they are missing, and Docker's
  `live-restore` keeps the containers running through that restart.

## The portal (`deploy/portal/`)

- `Dockerfile`: Next.js on Node 22, with Debian's Chromium for the PDF exports
  (`CHROME_PATH`).
- `restart.sh`: restart the running build, e.g. after a change to `portal.env`.
- `deploy.sh`: fetch, build (low CPU priority), swap, check `/login`, and go
  back to the previous build if the new one does not answer.

## Moving the data (`deploy/migrate/`)

The copy from Supabase cloud to this server, and the table-by-table comparison:
see `deploy/migrate/README.md`. The day itself is `deploy/SWITCH-OVER.md`.

## Scheduled jobs (`deploy/cron/`)

`portal.crontab` for the `portal` user; `run.sh` calls each job on
`127.0.0.1:3000` with `CRON_SECRET`, the same five jobs as `vercel.json`.

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
container: the same roles and tables as the live database.

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
