/**
 * Automations registry: the single source of truth for every automated moving
 * part in the portal (webhooks, cron jobs, background pings). It lives in code,
 * not the database, on purpose: it is versioned alongside the automation it
 * describes, so adding or changing an automation without updating this list
 * shows up in the same diff/review.
 *
 * WHEN YOU ADD OR CHANGE AN AUTOMATION, UPDATE THIS FILE. The /admin/automations
 * page renders straight from here and layers on live health where available.
 *
 * `healthService` links a row to a system_health_checks service key (see
 * lib/health/checks.ts HEALTH) so its card can show a live green/amber/red dot.
 */

export type AutomationKind = 'webhook' | 'cron' | 'client' | 'server-action'

export interface Automation {
  id: string
  name: string
  kind: AutomationKind
  /** What it does, in plain language. */
  purpose: string
  /** What fires it. */
  trigger: string
  /** Human + cron schedule, for scheduled jobs. */
  schedule?: string
  /** Where it lives in the codebase. */
  location: string
  /**
   * system_health_checks service keys, if this automation is monitored. A list
   * because one automation can have several independent signals: the Monday
   * webhook is both "is it still registered" and "are deliveries signed".
   * Every key listed here counts toward the page's overall status, so a signal
   * that is not on a card cannot quietly sit at warn while the header says
   * everything is operational.
   */
  healthServices?: string[]
  /** When it was added/last materially changed (absolute date). */
  since?: string
}

export const AUTOMATIONS: Automation[] = [
  {
    id: 'monday-page-sync',
    name: 'Monday page sync (Href Links)',
    kind: 'webhook',
    purpose:
      'When a language item’s "Href Links" status changes to "Run Link", saves that language’s URL and flips siblings to "Apply Link"; when it changes to "Done", marks the language confirmed live and completes the page once all languages are done. Refreshes the affected project page automatically.',
    trigger: 'Monday webhook POST to /api/monday/webhook/<secret> (the secret is the credential, see Settings)',
    location: 'src/app/api/monday/webhook/[secret]/route.ts, src/lib/monday/webhook-handler.ts, src/lib/monday/handlers.ts',
    healthServices: ['monday_webhook', 'monday_events'],
    since: '2026-08-04 (secret URL; the old unauthenticated /api/monday/webhook is gone)',
  },
  {
    id: 'monday-worklist',
    name: 'Monday work list (My Work)',
    kind: 'cron',
    purpose:
      'Reads every step assigned to somebody across all 197 boards that carry people columns, into monday_assignments, so My Work loads from Postgres instead of asking Monday on every page view. Refreshes the user, board and step maps at the head of each run. Chains, because 197 boards do not fit in one 300-second invocation: a firing takes as many boards as fit and then calls itself, up to eight hops, resuming from the board that has waited longest.',
    trigger: 'Server crontab (deploy/cron/portal.crontab)',
    schedule: 'Every 4 hours (15 1,5,9,13,17,21 * * *), the same window as the dashboard ingest',
    location: 'src/app/api/cron/monday-worklist/route.ts, src/lib/monday/worklist/',
    since: '2026-08-19',
  },
  {
    id: 'monday-ingest',
    name: 'Monday dashboard ingest',
    kind: 'cron',
    purpose: 'Re-fetches the Publishing boards from Monday into the warm snapshot store (monday_snapshot) so the dashboards load instantly.',
    trigger: 'Server crontab (deploy/cron/portal.crontab)',
    schedule: 'Every 4 hours (0 1,5,9,13,17,21 * * *)',
    location: 'src/app/api/cron/ingest/route.ts',
    healthServices: ['monday_api'],
  },
  {
    id: 'tsheets-sync',
    name: 'TSheets sync',
    kind: 'cron',
    purpose: 'Pulls job codes (into clients) and users (into the People directory) from TSheets, and syncs timesheets incrementally.',
    trigger: 'Server crontab (deploy/cron/portal.crontab)',
    schedule: 'Every 4 hours (30 1,5,9,13,17,21 * * *)',
    location: 'src/app/api/cron/tsheets-sync/route.ts',
    healthServices: ['tsheets_api'],
  },
  {
    id: 'clocky-delta',
    name: 'Clocky catch-up',
    kind: 'cron',
    purpose: 'Keeps the portal\u2019s copy of QuickBooks Time current while both run in parallel: new entries, edits, retroactive approvals and deletions. Skips itself if an import is already going, and stops mattering the day the portal becomes the clock.',
    trigger: 'Server crontab (deploy/cron/portal.crontab)',
    schedule: 'Every 4 hours (45 1,5,9,13,17,21 * * *)',
    location: 'src/app/api/cron/clocky-delta/route.ts',
    healthServices: ['tsheets_api'],
  },
  {
    id: 'daily-summary',
    name: 'Daily summary emails',
    kind: 'cron',
    purpose: 'Sends each person the notifications they chose for the daily summary, at their summary hour (8:00 unless they chose 6:00 to 10:00) in their own time zone, Monday to Friday except US federal holidays: one email for Tools and one for System at most, never an empty one. After a weekend or a holiday the next summary catches up on the days in between. Most runs find nothing to do.',
    trigger: 'Server crontab (deploy/cron/portal.crontab)',
    schedule: 'Every 15 minutes (*/15 * * * *)',
    location: 'src/app/api/cron/daily-summary/route.ts, src/lib/notifications/summary.ts, src/lib/email/summary.ts',
    healthServices: ['daily_summary'],
    since: '2026-10-07',
  },
  {
    id: 'health-check',
    name: 'Integration health check',
    kind: 'cron',
    purpose: 'Verifies Monday and TSheets connectivity, that the Monday webhooks are still registered, that events are still arriving, that the database protections are closed and that the daily summary email is going out. Records results and drives the status shown on this page and the dashboard banner.',
    trigger: 'Server crontab (deploy/cron/portal.crontab)',
    schedule: 'Daily at 9:00 UTC (0 9 * * *)',
    location: 'src/app/api/cron/health/route.ts, src/lib/health/checks.ts',
    healthServices: ['monday_api'],
    since: '2026-07-20',
  },
  {
    id: 'access-log',
    name: 'Access logging',
    kind: 'client',
    purpose: 'Records one portal-access row per session (name, email, timestamp, device) for the Access log tab and the "last access" shown on each person card.',
    trigger: 'AccessPing runs on app load, throttled to about once every 30 minutes per browser',
    location: 'src/components/AccessPing.tsx, src/app/(app)/access-actions.ts',
    since: '2026-07-17',
  },
]
