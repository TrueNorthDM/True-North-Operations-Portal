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

## Scheduled jobs (`deploy/cron/`)

`portal.crontab` for the `portal` user; `run.sh` calls each job on
`127.0.0.1:3000` with `CRON_SECRET`, the same five jobs as `vercel.json`.
