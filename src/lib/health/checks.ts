/**
 * Integration health checks.
 *
 * Verifies the portal's external dependencies are actually working, so a silent
 * outage (like the Monday webhook that quietly stopped delivering) surfaces on
 * the Automations page and a dashboard banner instead of going unnoticed.
 *
 * `runHealthChecks` performs the checks and records them; `latestHealth` reads
 * the most recent result per service for display. Both degrade gracefully if
 * the system_health_checks table doesn't exist yet (migration 046 not run).
 *
 * Pure-ish: takes a Supabase (service-role) client so it works from both the
 * cron and the admin "Run checks now" action.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type HealthStatus = 'ok' | 'warn' | 'down'

export interface HealthResult {
  service: string
  ok: boolean
  status: HealthStatus
  detail: string
  checked_at: string
}

// Service keys, also referenced by the automations registry so a card can show
// its live status. Keep in sync with registry.ts `healthService` values.
export const HEALTH = {
  mondayApi: 'monday_api',
  mondayWebhook: 'monday_webhook',
  mondayEvents: 'monday_events',
  tsheetsApi: 'tsheets_api',
  dbProtections: 'db_protections',
  dailySummary: 'daily_summary',
} as const

export const HEALTH_LABEL: Record<string, string> = {
  monday_api: 'Monday API',
  monday_webhook: 'Monday webhooks',
  monday_events: 'Monday event delivery',
  tsheets_api: 'TSheets API',
  db_protections: 'Database protections',
  daily_summary: 'Daily summary email',
}

const MONDAY_API = 'https://api.monday.com/v2'
const TSHEETS_BASE = 'https://rest.tsheets.com/api/v1'
// The webhook "exists" but delivers nothing failure mode is caught here: if no
// Monday event has been received in this many days, flag a soft warning.
/** How many recent deliveries the door count looks at. */
const DOOR_WINDOW = 20

const EVENT_STALE_DAYS = 7

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
  try {
    for (const s of sites) {
      const boardId = s.monday_board_id
      const hrefCol = s.monday_column_ids?.hrefLinksStatus
      if (!boardId || !hrefCol) continue
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
  return { service: HEALTH.mondayWebhook, ok: true, status: 'ok', detail: `Href Links webhook present on: ${present.join(', ') || '(no boards)'}.` }
}

async function checkMondayEvents(supabase: SupabaseClient): Promise<Check> {
  try {
    // A window rather than just the latest row. Two doors are open at once
    // during the cutover (the secret URL and the old unauthenticated one), so
    // the most recent delivery only tells you which fired last, not whether the
    // old door is still in use. Counting the window answers the question the
    // cutover actually turns on: has anything come through the old one lately.
    const { data, error } = await supabase
      .from('monday_events')
      .select('received_at, result')
      .order('received_at', { ascending: false })
      .limit(DOOR_WINDOW)
    if (error) return { service: HEALTH.mondayEvents, ok: true, status: 'warn', detail: `Could not read event log: ${error.message}` }

    const rows = (data ?? []) as { received_at?: string; result?: string | null }[]
    const last = rows[0]?.received_at
    if (!last) return { service: HEALTH.mondayEvents, ok: true, status: 'warn', detail: 'No Monday events recorded yet.' }

    const ageDays = Math.floor((Date.now() - new Date(last).getTime()) / 86400000)
    const when = ageDays === 0 ? 'today' : `${ageDays}d ago`
    if (ageDays > EVENT_STALE_DAYS) {
      return { service: HEALTH.mondayEvents, ok: false, status: 'warn', detail: `Last event ${ageDays} days ago. Expected activity, delivery may be broken.` }
    }

    // The webhook tags every row with the door it came through.
    const doorOf = (r: string | null | undefined) => /^([a-z-]+url)/.exec(r ?? '')?.[1]
    const secret = rows.filter(r => doorOf(r.result) === 'secret-url').length
    const legacy = rows.filter(r => doorOf(r.result) === 'legacy-url').length
    const untagged = rows.length - secret - legacy

    const counts = `Last ${rows.length} deliveries: ${secret} on the secret URL${legacy ? `, ${legacy} on the old one (now removed)` : ''}${untagged ? `, ${untagged} from before tagging` : ''}.`

    // A count alone cannot answer "is the old door still in use", because rows
    // from an earlier test stay inside the window and look identical to fresh
    // ones. The timestamp of the most recent legacy delivery can: delete a
    // webhook, trigger another change, and if this stamp has not moved, that
    // webhook was the one, and nothing else is knocking on the old door.
    // Only a RECENT legacy delivery is a problem. The unauthenticated route was
    // deleted, so nothing can arrive that way any more, but rows from before it
    // went stay in the window for a while. Warning on those would leave a
    // permanent alarm about something already fixed, which is how people learn
    // to ignore the page.
    const lastLegacy = rows.find(r => doorOf(r.result) === 'legacy-url')?.received_at
    const legacyIsRecent = lastLegacy != null && Date.now() - new Date(lastLegacy).getTime() < 86400000
    if (legacyIsRecent) {
      const stamp = new Date(lastLegacy!).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      return { service: HEALTH.mondayEvents, ok: false, status: 'warn', detail: `Last event ${when}. ${counts} One arrived on the OLD unauthenticated url at ${stamp}, which should no longer be possible.` }
    }
    if (secret === 0) {
      return { service: HEALTH.mondayEvents, ok: false, status: 'warn', detail: `Last event ${when}. ${counts} Nothing has arrived on the secret URL yet.` }
    }
    return { service: HEALTH.mondayEvents, ok: true, status: 'ok', detail: `Last event ${when}. ${counts}` }
  } catch (e) {
    return { service: HEALTH.mondayEvents, ok: true, status: 'warn', detail: (e as Error).message }
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
  if (error) return { service: HEALTH.dbProtections, ok: true, status: 'warn', detail: `Could not run the check (migration 098?): ${error.message}` }
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
    return { service: HEALTH.dailySummary, ok: true, status: 'warn', detail: `Could not read the summary log: ${(digests.error ?? stale.error)!.message}` }
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

/** Run every check, persist the results (best-effort), and return them. */
export async function runHealthChecks(supabase: SupabaseClient): Promise<HealthResult[]> {
  const { data: settings } = await supabase.from('app_settings').select('monday_api_token, tsheets_api_token').eq('singleton_id', 1).maybeSingle()
  const s = settings as { monday_api_token?: string | null; tsheets_api_token?: string | null } | null
  const mondayToken = s?.monday_api_token ?? ''
  const tsheetsToken = s?.tsheets_api_token ?? ''

  const { data: siteData } = await supabase.from('sites').select('code, monday_board_id, monday_column_ids').in('code', ['hfa', 'aaaf'])
  const sites = (siteData ?? []) as unknown as SiteHook[]

  const checks = await Promise.all([
    checkMondayApi(mondayToken),
    checkMondayWebhooks(mondayToken, sites),
    checkMondayEvents(supabase),
    checkTsheets(tsheetsToken),
    checkDbProtections(supabase),
    checkDailySummary(supabase),
  ])

  const checkedAt = new Date().toISOString()
  const results: HealthResult[] = checks.map(c => ({ ...c, checked_at: checkedAt }))

  // Best-effort persist. If the table isn't there yet (migration 046 pending),
  // just skip, the checks still ran and the caller gets the live results.
  try {
    await supabase.from('system_health_checks').insert(results.map(r => ({ service: r.service, ok: r.ok, status: r.status, detail: r.detail })))
  } catch { /* table missing or transient, ignore */ }

  return results
}

/** Latest recorded result per service (for the page + banner). Empty if the table is missing. */
export async function latestHealth(supabase: SupabaseClient): Promise<Record<string, HealthResult>> {
  try {
    const { data, error } = await supabase
      .from('system_health_checks')
      .select('service, ok, status, detail, checked_at')
      .order('checked_at', { ascending: false })
      .limit(80)
    if (error || !data) return {}
    const out: Record<string, HealthResult> = {}
    for (const row of data as unknown as HealthResult[]) {
      if (!out[row.service]) out[row.service] = row
    }
    return out
  } catch {
    return {}
  }
}
