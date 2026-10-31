/**
 * Busy times from Google (owner, 30 October 2026): when a Google-connected
 * account is busy, read with Google's free/busy (only the times, never what
 * the events are) into agenda_busy with source 'google'. Find a time and the
 * booking page call refreshGoogleBusy before they read agenda_busy; a copy
 * younger than FRESH_MS is used as it is. Server only.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { accessTokenFor } from './google-app'

/** How long a read copy counts as current. */
export const FRESH_MS = 5 * 60_000
/** What one read covers: from a day back to two months ahead, the booking page's window with room. */
const BACK_MS = 864e5
const AHEAD_MS = 62 * 864e5
/** Google answers free/busy for a limited stretch at once, so longer reads go in pieces. */
const PIECE_MS = 60 * 864e5
/** Find a time waits this long for Google at most, then uses the copy it has. */
const WAIT_MS = 4000

export interface ReadState { busyFrom: string | null; busyTo: string | null; busyReadAt: string | null }

/** The stretch to read again for [lo, hi), or null when the stored copy covers it and is fresh. */
export function stretchToRead(s: ReadState, lo: number, hi: number, now: number): [number, number] | null {
  const from = s.busyFrom ? Date.parse(s.busyFrom) : NaN
  const to = s.busyTo ? Date.parse(s.busyTo) : NaN
  const at = s.busyReadAt ? Date.parse(s.busyReadAt) : NaN
  if (from <= lo && to >= hi && now - at < FRESH_MS) return null
  return [Math.min(lo, now - BACK_MS), Math.max(hi, now + AHEAD_MS)]
}

/** [lo, hi) cut into pieces Google takes in one call. */
export function pieces(lo: number, hi: number): [number, number][] {
  const out: [number, number][] = []
  for (let a = lo; a < hi; a += PIECE_MS) out.push([a, Math.min(hi, a + PIECE_MS)])
  return out
}

/** Google's answer for the primary calendar: the busy stretches, or the reason it gave none. */
export function readAnswer(json: unknown): { busy: [string, string][] } | { error: string } {
  const cal = (json as { calendars?: { primary?: { busy?: { start?: unknown; end?: unknown }[]; errors?: { reason?: string }[] } } })?.calendars?.primary
  if (!cal) return { error: 'no answer for the calendar' }
  if (cal.errors?.length) return { error: cal.errors.map(e => e.reason ?? 'unknown').join(', ') }
  return { busy: (cal.busy ?? []).filter(b => typeof b.start === 'string' && typeof b.end === 'string' && b.end > b.start).map(b => [b.start as string, b.end as string]) }
}

async function askGoogle(token: string, lo: number, hi: number, signal: AbortSignal): Promise<[string, string][]> {
  const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST', signal,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ timeMin: new Date(lo).toISOString(), timeMax: new Date(hi).toISOString(), items: [{ id: 'primary' }] }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`free/busy answered ${res.status}`)
  const a = readAnswer(json)
  if ('error' in a) throw new Error(`free/busy: ${a.error}`)
  return a.busy
}

/**
 * Brings the Google busy times of these accounts up to date for [lo, hi).
 * Never throws: an account Google does not answer for keeps its last copy,
 * and the reason goes to the server log.
 */
export async function refreshGoogleBusy(accountIds: number[], lo: number, hi: number, now = Date.now()): Promise<void> {
  if (!accountIds.length) return
  const c = createAdminClient()
  const { data, error } = await c.from('agenda_account_tokens').select('account_id, busy_from, busy_to, busy_read_at').in('account_id', accountIds)
  if (error) { console.error('[agenda google] busy state:', error.message); return }
  const signal = AbortSignal.timeout(WAIT_MS)
  await Promise.all((data ?? []).map(async t => {
    const stretch = stretchToRead({ busyFrom: t.busy_from, busyTo: t.busy_to, busyReadAt: t.busy_read_at }, lo, hi, now)
    if (!stretch) return
    try {
      const token = await accessTokenFor(t.account_id, now)
      if (!token) return
      const busy = (await Promise.all(pieces(...stretch).map(([a, b]) => askGoogle(token, a, b, signal)))).flat()
      const fromIso = new Date(stretch[0]).toISOString(), toIso = new Date(stretch[1]).toISOString()
      // Replace the stretch read: what Google no longer says is busy goes.
      const del = await c.from('agenda_busy').delete().eq('account_id', t.account_id).eq('source', 'google').lt('starts_at', toIso).gt('ends_at', fromIso)
      if (del.error) throw new Error(del.error.message)
      if (busy.length) {
        const ins = await c.from('agenda_busy').insert(busy.map(([s, e]) => ({ account_id: t.account_id, starts_at: s, ends_at: e, source: 'google', read_at: new Date(now).toISOString() })))
        if (ins.error) throw new Error(ins.error.message)
      }
      const up = await c.from('agenda_account_tokens').update({ busy_from: fromIso, busy_to: toIso, busy_read_at: new Date(now).toISOString() }).eq('account_id', t.account_id)
      if (up.error) throw new Error(up.error.message)
    } catch (e) {
      console.error(`[agenda google] busy for account ${t.account_id}:`, e instanceof Error ? e.message : e)
    }
  }))
}
