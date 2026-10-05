# Switch-over day: moving the live portal to its own server

The plan for phase 6 of the migration (and the rehearsal in phase 5 that comes
before it). Today the live portal is on Vercel
(`truenorthoperationsportal.vercel.app`) with its data on Supabase cloud. After
the switch it is `https://truenorthportal.online`, on the ScalaHosting server
described in `deploy/README.md`.

The rule for the day: **nothing is changed on the old portal until the new one
is confirmed**. Until the go/no-go point (step 9) the way back is simply to
unpause the old portal.

## Before the day

| When | What | Who |
|---|---|---|
| Phase 5 | Rehearsal: copy the live data into the server (`p5-copy`), compare every table (`p5-compare`), try the main screens on staging (`p5-you`), time the copy (`p5-time`). The copy and count scripts used on the day are the ones proven here. | Claude, Arnaldo |
| Phase 5 | Check two-step sign-in survives the copy: if Supabase cloud encrypts the authenticator secrets, people set their app up again (a Reset for everyone) and the announcement says so. | Claude |
| 1 week before | Forward `truenorthportal.online` and `www` to `127.0.0.1:3000`, with SSL, as staging is. Done 5 October 2026 with the same `.htaccess` (see `deploy/README.md`, Public addresses). | Claude |
| 3 days before | Tell the team the date and the window (`p6-tell`). A weekend evening, US time. | Arnaldo |
| The day before | A fresh backup of the server; check the disk has room for the data. | Claude |

## On the day

Rough times, to be replaced by the rehearsal's (`p5-time`).

| # | Step | Checklist | Time |
|---|---|---|---|
| 1 | Turn on the maintenance page on the old portal: `MAINTENANCE_MODE=1` in Vercel's production environment, then redeploy. Every page shows it; cron jobs, Monday webhooks and form posts get 503, so nothing changes in the old data from here on (`src/lib/switch-over.ts`). | `p6-freeze` | 5 min |
| 2 | `deploy/migrate/copy.sh --reset` on the server: an empty database, then the schema, the sign-in accounts with their two-step factors, all the portal's data and the uploaded files, copied from Supabase cloud. | `p6-copy` | the rehearsal's time |
| 3 | Its last step compares every table, number by number (`compare.sh`). Any difference stops the switch here. | `p6-counts` | included |
| 4 | Check the log for warnings (a trigger or policy that could not be added). | | 5 min |
| 5 | Point everything at the real address: `PORTAL_URL=https://truenorthportal.online` in `apply-env.sh` (sign-in links, email templates, redirects), `APP_URL` in `portal.env`; restart the sign-in service and the portal. | `p6-redirects` | 5 min |
| 6 | Open `https://truenorthportal.online`, sign in (code and two-step), open Home, Directory, My Work and the i7 report. | `p6-dns` | 10 min |
| 7 | Re-point the Monday webhooks to `https://truenorthportal.online/api/monday/webhook/...` (by hand in Monday). | `p6-webhooks` | 10 min |
| 8 | Install the scheduled jobs (`deploy/cron/portal.crontab`) and watch the first Monday and TSheets syncs land. | `p6-cron` | 30 min, mostly waiting |
| 9 | **Go / no-go.** From here the new portal is where data is written. | | |
| 10 | Switch the old address to redirect to the new one: `LEGACY_REDIRECT_TO=https://truenorthportal.online` on Vercel, redeploy. Every path and query goes to the same place on the new address (308), so bookmarks and links in PDFs already sent keep working; Vercel's cron calls get 410. | | 5 min |
| 11 | Invitations go out; everyone signs in again (sessions do not carry over). | `p6-invites` | |
| 12 | Tell the team the portal is back, at its new address. | `p6-announce` | |

## The days after

- Use the reports and exports for real (i7 PDF and image, Report PDF) on the
  server's Chromium (`p6-use`).
- Confirm the first nightly backup, and repeat the restore test with real data
  (`p6-backup`).
- Switch on `push` in `.github/workflows/deploy-server.yml`, so every push to
  main publishes to the server, and retire `deploy-vercel.yml`.
- Point the uptime check (`.github/workflows/uptime.yml`) at
  `https://truenorthportal.online/login` and drop the staging line.
- Two weeks later, phase 7 closes the old services. The redirect from the old
  address stays (links in PDFs sent to clients point at it).

## Going back

Before step 9: remove `MAINTENANCE_MODE` on Vercel and redeploy. Nothing was
written to the old data, so it is exactly as it was.

After step 9: the new portal has data the old one does not. Going back then
means copying those changes back by hand, so the go/no-go is the last easy exit.
