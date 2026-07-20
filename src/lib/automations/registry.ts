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
  /** system_health_checks service key, if this automation is monitored. */
  healthService?: string
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
    trigger: 'Monday webhook POST to /api/monday/webhook',
    location: 'src/app/api/monday/webhook/route.ts, src/lib/monday/handlers.ts',
    healthService: 'monday_webhook',
    since: '2026-07-20 (webhooks recreated after a stale-URL outage)',
  },
  {
    id: 'monday-ingest',
    name: 'Monday dashboard ingest',
    kind: 'cron',
    purpose: 'Re-fetches the Publishing boards from Monday into the warm snapshot store (monday_snapshot) so the dashboards load instantly.',
    trigger: 'Vercel Cron',
    schedule: 'Every 4 hours (0 1,5,9,13,17,21 * * *)',
    location: 'src/app/api/cron/ingest/route.ts',
    healthService: 'monday_api',
  },
  {
    id: 'tsheets-sync',
    name: 'TSheets sync',
    kind: 'cron',
    purpose: 'Pulls job codes (into clients) and users (into the People directory) from TSheets, and syncs timesheets incrementally.',
    trigger: 'Vercel Cron',
    schedule: 'Every 4 hours (30 1,5,9,13,17,21 * * *)',
    location: 'src/app/api/cron/tsheets-sync/route.ts',
    healthService: 'tsheets_api',
  },
  {
    id: 'health-check',
    name: 'Integration health check',
    kind: 'cron',
    purpose: 'Verifies Monday and TSheets connectivity, that the Monday webhooks are still registered, and that events are still arriving. Records results and drives the status shown on this page and the dashboard banner.',
    trigger: 'Vercel Cron',
    schedule: 'Every 2 days (0 9 */2 * *)',
    location: 'src/app/api/cron/health/route.ts, src/lib/health/checks.ts',
    healthService: 'monday_api',
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
