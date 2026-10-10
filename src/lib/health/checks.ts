/**
 * Integration health checks.
 *
 * Verifies the portal's external dependencies are actually working, so a silent
 * outage (like the Monday webhook that quietly stopped delivering) surfaces on
 * the Automations page and a dashboard banner instead of going unnoticed.
 *
 * `runHealthChecks` performs the checks and records them; `latestHealth` reads
 * the most recent result per service for display, and summary.ts says what
 * they add up to. A check that could not run is a problem, not "ok" (audit,
 * 10 October 2026). Runs every four hours (deploy/cron/portal.crontab).
 *
 * Pure-ish: takes a Supabase (service-role) client so it works from both the
 * cron and the admin "Run checks now" action.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { BOARDS, PUBLISHING_BOARD_IDS } from '@/lib/boards/config'

export type HealthStatus = 'ok' | 'warn' | 'down'

export interface HealthResult {
  service: string
  ok: boolean
  status: HealthStatus
  detail: string
  checked_at: string
}

// Service keys, also referenced by the automations registry so a card can show
// its live status. Keep in sync with registry.ts `healthServices` values.
export const HEALTH = {
  mondayApi: 'monday_api',
  mondayWebhook: 'monday_webhook',
  mondayEvents: 'monday_events',
  tsheetsApi: 'tsheets_api',
  dbProtections: 'db_protections',
  dailySummary: 'daily_summary',
  publishingSnapshot: 'publishing_snapshot',
} as const

export const HEALTH_LABEL: Record<string, string> = {
  monday_api: 'Monday API',
  monday_webhook: 'Monday webhooks',
  monday_events: 'Monday event delivery',
  tsheets_api: 'TSheets API',
  db_protections: 'Database protections',
  daily_summary: 'Daily summary email',
  publishing_snapshot: 'Publishing boards pull',
}

const MONDAY_API = 'https://api.monday.com/v2'
const TSHEETS_BASE = 'https://rest.tsheets.com/api/v1'
// The webhook "exists" but delivers nothing failure mode is caught here: if no
// Monday event has been received in this many days, flag a soft warning.
const EVENT_STALE_DAYS = 7
const EVENT_DOWN_DAYS = 14

type Check = Omit<HealthResult, 'checked_at'>

async function checkMondayApi(token: string): Promise<Check> {
  if (!token) return { service: HEALTH.mondayApi, ok: false, status: 'down', detail: 'No Monday API token configured (Settings).' }
  try {
    const res = await fetch(MONDAY_API, {
      method: 'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json', 'API-Version': '2024-10' },
      body: JSON.stringify({ query: '{ me { id name } }' }),
    })
    const json = (await res.json()) as { data?: { me?: { name?: string } }; errors?: { message: string }[] }
    if (json.errors?.length) return { service: HEALTH.mondayApi, ok: false, status: 'down', detail: json.errors.map(e => e.message).join('; ') }
    const name = json.data?.me?.name
    if (!name) return { service: HEALTH.mondayApi, ok: false, status: 'down', detail: 'Token did not resolve to a Monday user.' }
    return { service: HEALTH.mondayApi, ok: true, status: 'ok', detail: `Authenticated as ${name}.` }
  } catch (e) {
    return { service: HEALTH.mondayApi, ok: false, status: 'down', detail: (e as Error).message }
  }
}

interface SiteHook { code: string; monday_board_id: string | null; monday_column_ids: { hrefLinksStatus?: string } | null }

async function checkMondayWebhooks(token: string, sites: SiteHook[]): Promise<Check> {
  if (!token) return { service: HEALTH.mondayWebhook, ok: false, status: 'down', detail: 'No Monday API token, cannot list webhooks.' }
  const missing: string[] = []
  const present: string[] = []
  const unset: string[] = []
  try {
    for (const s of sites) {
      const boardId = s.monday_board_id
      const hrefCol = s.monday_column_ids?.hrefLinksStatus
      if (!boardId || !hrefCol) { unset.push(s.code.toUpperCase()); continue }
      const res = await fetch(MONDAY_API, {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json', 'API-Version': '2024-10' },
        body: JSON.stringify({ query: 'query ($b: ID!){ webhooks(board_id: $b){ id event config } }', variables: { b: boardId } }),
      })
      const json = (await res.json()) as { data?: { webhooks?: { config?: string }[] }; errors?: { message: string }[] }
      if (json.errors?.length) return { service: HEALTH.mondayWebhook, ok: false, status: 'down', detail: `${s.code}: ${json.errors.map(e => e.message).join('; ')}` }
      const has = (json.data?.webhooks ?? []).some(w => typeof w.config === 'string' && w.config.includes(hrefCol))
      if (has) present.push(s.code.toUpperCase()); else missing.push(s.code.toUpperCase())
    }
  } catch (e) {
    return { service: HEALTH.mondayWebhook, ok: false, status: 'down', detail: (e as Error).message }
  }
  if (missing.length > 0) return { service: HEALTH.mondayWebhook, ok: false, status: 'down', detail: `No Href Links webhook on: ${missing.join(', ')}. Page sync is broken for these.` }
  // Nothing checked is not "present" (audit, 10 October 2026).
  if (!present.length) return { service: HEALTH.mondayWebhook, ok: false, status: 'down', detail: 'No site has a Monday board and Href Links column set, so no webhook was checked.' }
  if (unset.length) return { service: HEALTH.mondayWebhook, ok: false, status: 'warn', detail: `Href Links webhook present on: ${present.join(', ')}. Not checked (no board or column in Settings): ${unset.join(', ')}.` }
  return { service: HEALTH.mondayWebhook, ok: true, status: 'ok', detail: `Href Links webhook present on: ${present.join(', ')}.` }
}

/**
 * Are Monday deliveries still arriving? Silence for more than a week is a
 * warning, for two weeks a failure (decided 10 October 2026): in August the
 * webhook was silent for 18 days and only a warning, which nobody saw.
 */
async function checkMondayEvents(supabase: SupabaseClient): Promise<Check> {
  try {
    const { data, error } = await supabase
      .from('monday_events')
      .select('received_at')
      .order('received_at', { ascending: false })
      .limit(1)
    if (error) return { service: HEALTH.mondayEvents, ok: false, status: 'warn', detail: `Could not read the event log: ${error.message}` }
    const last = ((data ?? []) as { received_at?: string }[])[0]?.received_at
    if (!last) return { service: HEALTH.mondayEvents, ok: false, status: 'warn', detail: 'No Monday events recorded yet.' }
    const ageDays = Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000)
    const when = ageDays === 0 ? 'today' : `${ageDays} day${ageDays === 1 ? '' : 's'} ago`
    if (ageDays >= EVENT_DOWN_DAYS) {
      return { service: HEALTH.mondayEvents, ok: false, status: 'down', detail: `Last event ${when}. Monday deliveries have stopped: check the webhooks on the Href Links boards.` }
    }
    if (ageDays > EVENT_STALE_DAYS) {
      return { service: HEALTH.mondayEvents, ok: false, status: 'warn', detail: `Last event ${when}. Expected activity, delivery may be broken.` }
    }
    return { service: HEALTH.mondayEvents, ok: true, status: 'ok', detail: `Last event ${when}.` }
  } catch (e) {
    return { service: HEALTH.mondayEvents, ok: false, status: 'warn', detail: (e as Error).message }
  }
}

async function checkTsheets(token: string): Promise<Check> {
  if (!token) return { service: HEALTH.tsheetsApi, ok: false, status: 'down', detail: 'No TSheets token configured (Settings).' }
  try {
    const res = await fetch(`${TSHEETS_BASE}/current_user`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
    if (!res.ok) return { service: HEALTH.tsheetsApi, ok: false, status: 'down', detail: `HTTP ${res.status} from current_user.` }
    const json = (await res.json()) as { error?: { message?: string } }
    if (json.error) return { service: HEALTH.tsheetsApi, ok: false, status: 'down', detail: json.error.message ?? 'API error.' }
    return { service: HEALTH.tsheetsApi, ok: true, status: 'ok', detail: 'Token valid.' }
  } catch (e) {
    return { service: HEALTH.tsheetsApi, ok: false, status: 'down', detail: (e as Error).message }
  }
}

/**
 * Are the database's own protections still closed (migration 098): pay and
 * contact columns, and the functions meant for the server alone? A move or a
 * restore reopened them once (found 8 October 2026); this notices the next.
 */
async function checkDbProtections(supabase: SupabaseClient): Promise<Check> {
  const { data, error } = await supabase.rpc('db_protections_check')
  // Could not run is a failure here: this is the check that caught the open
  // database gate, and a silent one is no check (audit, 10 October 2026).
  if (error) return { service: HEALTH.dbProtections, ok: false, status: 'down', detail: `Could not run the check: ${error.message}. Run supabase/migrations/108 again.` }
  const open = (data ?? []) as string[]
  if (open.length) return { service: HEALTH.dbProtections, ok: false, status: 'down', detail: `Open again: ${open.slice(0, 4).join('; ')}${open.length > 4 ? `; and ${open.length - 4} more` : ''}. Run supabase/migrations/098 again.` }
  return { service: HEALTH.dbProtections, ok: true, status: 'ok', detail: 'Pay, contact and server-only functions are closed to signed-in and anonymous roles.' }
}

/**
 * Is the daily summary email going out (audit, 9 October 2026)? Its failures
 * were invisible: the run answered "ok" and nothing watched it. Down when a
 * summary gave up after its tries or a claim is stuck; a warning when daily
 * notifications have waited five days without an email (the run not running).
 */
async function checkDailySummary(supabase: SupabaseClient): Promise<Check> {
  const since = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10)
  const [digests, stale] = await Promise.all([
    supabase.from('notification_digests').select('status, attempts, updated_at, error').gte('local_day', since),
    supabase.from('notifications').select('id', { count: 'exact', head: true })
      .eq('timing', 'daily').is('emailed_at', null).lt('deliver_at', new Date(Date.now() - 5 * 86_400_000).toISOString()),
  ])
  if (digests.error || stale.error) {
    return { service: HEALTH.dailySummary, ok: false, status: 'warn', detail: `Could not read the summary log: ${(digests.error ?? stale.error)!.message}` }
  }
  const rows = (digests.data ?? []) as { status: string; attempts: number; updated_at: string; error: string | null }[]
  const gaveUp = rows.filter(r => r.status === 'failed' && r.attempts >= 3)
  const stuck = rows.filter(r => r.status === 'sending' && Date.now() - new Date(r.updated_at).getTime() > 60 * 60_000)
  if (gaveUp.length || stuck.length) {
    const why = gaveUp[0]?.error ? ` Last error: ${gaveUp[0].error}` : ''
    return { service: HEALTH.dailySummary, ok: false, status: 'down', detail: `${gaveUp.length} summary email(s) gave up after 3 tries, ${stuck.length} stuck while sending, in the last two days.${why}` }
  }
  if ((stale.count ?? 0) > 0) {
    return { service: HEALTH.dailySummary, ok: false, status: 'warn', detail: `${stale.count} daily notification(s) have waited more than five days for their email. Is the daily-summary cron running?` }
  }
  const sent = rows.filter(r => r.status === 'sent').length
  return { service: HEALTH.dailySummary, ok: true, status: 'ok', detail: `${sent} summary email(s) sent in the last two days, none failing.` }
}

/**
 * Are the publishing boards being pulled (audit, 10 October 2026)? The pull
 * runs every four hours, and a board failing for days was hidden behind the
 * other one: Settings showed the newer pull, and the run answered "ok".
 */
const SNAPSHOT_STALE_HOURS = 12

async function checkPublishingSnapshot(supabase: SupabaseClient): Promise<Check> {
  const { data, error } = await supabase.from('monday_snapshot').select('board_id, ingested_at')
  if (error) return { service: HEALTH.publishingSnapshot, ok: false, status: 'warn', detail: `Could not read the pulls: ${error.message}` }
  const rows = (data ?? []) as { board_id: string; ingested_at: string | null }[]
  const missing = PUBLISHING_BOARD_IDS.filter(id => !rows.some(r => r.board_id === id))
  const stale = rows.filter(r => PUBLISHING_BOARD_IDS.includes(r.board_id)
    && (!r.ingested_at || Date.now() - Date.parse(r.ingested_at) > SNAPSHOT_STALE_HOURS * 3_600_000))
  if (missing.length || stale.length) {
    const names = [...missing, ...stale.map(r => r.board_id)].map(id => BOARDS[id]?.short ?? id).join(', ')
    return { service: HEALTH.publishingSnapshot, ok: false, status: 'down', detail: `Not pulled in the last ${SNAPSHOT_STALE_HOURS} hours: ${names}. Publishing Goals is showing old numbers.` }
  }
  return { service: HEALTH.publishingSnapshot, ok: true, status: 'ok', detail: `Both publishing boards pulled in the last ${SNAPSHOT_STALE_HOURS} hours.` }
}

/** Run every check, persist the results (best-effort), and return them. */
export async function runHealthChecks(supabase: SupabaseClient): Promise<HealthResult[]> {
  const { data: settings } = await supabase.from('app_settings').select('monday_api_token, tsheets_api_token').eq('singleton_id', 1).maybeSingle()
  const s = settings as { monday_api_token?: string | null; tsheets_api_token?: string | null } | null
  const mondayToken = s?.monday_api_token ?? ''
  const tsheetsToken = s?.tsheets_api_token ?? ''

  const { data: siteData, error: siteErr } = await supabase.from('sites').select('code, monday_board_id, monday_column_ids').in('code', ['hfa', 'aaaf'])
  if (siteErr) console.error('[health] reading the sites:', siteErr.message)
  const sites = (siteData ?? []) as unknown as SiteHook[]

  const checks = await Promise.all([
    checkMondayApi(mondayToken),
    checkMondayWebhooks(mondayToken, sites),
    checkMondayEvents(supabase),
    checkTsheets(tsheetsToken),
    checkDbProtections(supabase),
    checkDailySummary(supabase),
    checkPublishingSnapshot(supabase),
  ])

  const checkedAt = new Date().toISOString()
  const results: HealthResult[] = checks.map(c => ({ ...c, checked_at: checkedAt }))

  // The webhook log keeps what it ignored for 90 days (migration 107); the
  // daily check is the job that runs every day anyway.
  const { error: pruneErr } = await supabase.rpc('prune_monday_events')
  if (pruneErr) console.error('[health] pruning the webhook log:', pruneErr.message)

  // Said when it fails: "Run checks now" otherwise appeared to do nothing.
  const { error: saveErr } = await supabase.from('system_health_checks')
    .insert(results.map(r => ({ service: r.service, ok: r.ok, status: r.status, detail: r.detail })))
  if (saveErr) console.error('[health] the results were not saved:', saveErr.message)

  return results
}

/**
 * Latest recorded result per service (for the page and the banner), and
 * whether they could be read at all: an unreadable history is not "no checks
 * recorded yet" (audit, 10 October 2026).
 */
export async function latestHealth(supabase: SupabaseClient): Promise<{ results: Record<string, HealthResult>; readError: string | null }> {
  const { data, error } = await supabase
    .from('system_health_checks')
    .select('service, ok, status, detail, checked_at')
    .order('checked_at', { ascending: false })
    .limit(80)
  if (error) {
    console.error('[health] reading the results:', error.message)
    return { results: {}, readError: 'The health results could not be read just now.' }
  }
  const results: Record<string, HealthResult> = {}
  for (const row of (data ?? []) as unknown as HealthResult[]) {
    if (!results[row.service]) results[row.service] = row
  }
  return { results, readError: null }
}
