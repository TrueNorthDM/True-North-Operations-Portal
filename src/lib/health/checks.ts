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
} as const

export const HEALTH_LABEL: Record<string, string> = {
  monday_api: 'Monday API',
  monday_webhook: 'Monday webhooks',
  monday_events: 'Monday event delivery',
  tsheets_api: 'TSheets API',
}

const MONDAY_API = 'https://api.monday.com/v2'
const TSHEETS_BASE = 'https://rest.tsheets.com/api/v1'
// The webhook "exists" but delivers nothing failure mode is caught here: if no
// Monday event has been received in this many days, flag a soft warning.
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
    const { data, error } = await supabase.from('monday_events').select('received_at, result').order('received_at', { ascending: false }).limit(1)
    if (error) return { service: HEALTH.mondayEvents, ok: true, status: 'warn', detail: `Could not read event log: ${error.message}` }
    const row = data?.[0] as { received_at?: string; result?: string | null } | undefined
    const last = row?.received_at
    if (!last) return { service: HEALTH.mondayEvents, ok: true, status: 'warn', detail: 'No Monday events recorded yet.' }
    const ageMs = Date.now() - new Date(last).getTime()
    const ageDays = Math.floor(ageMs / 86400000)
    const when = ageDays === 0 ? 'today' : `${ageDays}d ago`

    // The webhook records the signature verdict on each row while it runs in
    // monitor mode. Surfacing it here is how you know whether enforcement can
    // be switched on: it has to read "verified" on real deliveries first.
    const sig = /^sig:([^ ·]+)/.exec(row?.result ?? '')?.[1]
    const sigNote =
      sig === 'verified' ? ' Signature verified, safe to enforce.'
        : sig === 'no-secret' ? ' Signature NOT checked: no secret saved, so unsigned calls are accepted.'
          : sig ? ` Signature check FAILED (${sig}); the saved secret does not match.`
            : ''

    if (ageDays > EVENT_STALE_DAYS) return { service: HEALTH.mondayEvents, ok: false, status: 'warn', detail: `Last event ${ageDays} days ago. Expected activity, delivery may be broken.${sigNote}` }
    if (sig && sig !== 'verified') return { service: HEALTH.mondayEvents, ok: false, status: 'warn', detail: `Last event ${when}.${sigNote}` }
    return { service: HEALTH.mondayEvents, ok: true, status: 'ok', detail: `Last event ${when}.${sigNote}` }
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
