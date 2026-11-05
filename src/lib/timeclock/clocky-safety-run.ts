/**
 * The safety net's job (design handoff of 16 October 2026, README "Rules" 4
 * and 5; leadership's rules of 4 November 2026): every 5 minutes, from the
 * server's crontab (/api/cron/clocky-safety).
 *
 * For every one of North Time's own clocks still running:
 *   - at 12h 00m into its window (since the clock in, across switches): North
 *     Time ends the entry at the 12-hour mark (recorded on the quarter hour,
 *     the real mark kept), logs it, and tells the person in the bell and by
 *     the one email, "Your clock stopped by itself";
 *   - at the person's hours allowance (owner, 25 October 2026): the clock
 *     ends at the instant the allowance plus the extra hours approved was
 *     reached, with a line in its history and the bell ("Your clock stopped
 *     at 4:15 PM: you have used your 140h 00m allowance for October..."),
 *     nothing to confirm (allowance-limit.ts). Whichever comes first.
 * There is no "Still working?" step any more (safety.ts).
 *
 * Only North Time's own clocks (source 'portal'), and only for people whose
 * start date has arrived in their own time zone (audit, 5 November 2026).
 * Clocks still open in TSheets come in through the import as running clocks
 * (source 'tsheets'): they are TSheets' to end, so this job never stops them
 * or marks them changed (which would make the import leave them alone and
 * lose the real end). People before their start date, in no wave or with no
 * date still record in TSheets, so their clocks are left alone too. An
 * unread start date fails the run rather than act on everyone.
 *
 * Once a day it also writes the Super Admins' line about yesterday's
 * automatic clock-outs (their daily summary).
 */

import type { Db } from '@/lib/supabase/types'
import { notifyClockyAutoStops } from '@/lib/notifications/run'
import { allRows, loadCatalog, loadDirectory } from './clocky-context'
import type { EntryRow } from './clocky-store'
import { announceClockStop } from './clocky-notify'
import { safetyState, windowStart } from './safety'
import { stopClockIfDue } from './allowance-limit'
import { loadPayTerms } from './pay-terms'
import { loadStartDates } from './waves-data'
import { hasStarted } from './waves'
import { localDate } from './format'

export interface SafetyRunReport {
  /** North Time's own running clocks of people who have started. */
  running: number
  /** Kept for the cron's answer: there is no "Still working?" step any more, so always 0. */
  warned: number
  stopped: number
  /** Of them, stopped at the allowance. */
  atLimit: number
  summary: string | null
  errors: string[]
}

/**
 * The running clocks this job may act on: the portal's own (the query asks
 * for source 'portal' already; checked again here), of people whose start
 * date has arrived in their own zone. Pure.
 */
export function clocksToWatch<T extends Pick<EntryRow, 'person_id' | 'source'>>(
  running: readonly T[], starts: ReadonlyMap<string, string>, zoneOf: (personId: string) => string, now: Date,
): T[] {
  return running.filter(e => e.source === 'portal' && hasStarted(starts.get(e.person_id) ?? null, localDate(now, zoneOf(e.person_id))))
}

export async function runClockSafety(c: Db, opts: { now?: Date; origin: string }): Promise<SafetyRunReport> {
  const now = opts.now ?? new Date()
  const report: SafetyRunReport = { running: 0, warned: 0, stopped: 0, atLimit: 0, summary: null, errors: [] }
  const [dir, catalog] = await Promise.all([loadDirectory(), loadCatalog()])
  const open = await allRows<EntryRow>((a, b) => c.from('tc_entries').select('*').eq('kind', 'clock').eq('source', 'portal')
    .is('ended_at', null).not('started_at', 'is', null).order('id').range(a, b), 'The running clocks could not be read')
  // Each person's start date; a failed read throws, and the run fails (never "everyone started").
  const starts = open.length ? await loadStartDates(c) : new Map<string, string>()
  const running = clocksToWatch(open, starts, dir.zoneOf, now)
  report.running = running.length
  // The allowances of the people on the clock, read once.
  const terms = running.length ? await loadPayTerms([...new Set(running.map(e => e.person_id))]) : new Map()

  for (const e of running) {
    try {
      const ws = windowStart(e)
      if (!ws) continue
      const allowance = terms.get(e.person_id)?.allowance ?? null
      if (!safetyState(ws, now).due && !allowance) continue
      const stop = await stopClockIfDue(c, e, now, dir, catalog, allowance)
      if (!stop) continue
      report.stopped++
      if (stop.kind === 'limit') report.atLimit++
      await announceClockStop(stop, opts.origin, now, c)
    } catch (err) {
      report.errors.push(`entry ${e.id}: ${(err as Error).message}`)
    }
  }

  try {
    const s = await notifyClockyAutoStops(now, c)
    if (s) report.summary = s.skipped ?? `${s.rows ?? 0} written`
    if (s && Object.keys(s.failed).length) report.errors.push(`summary: ${Object.values(s.failed)[0]}`)
  } catch (err) {
    report.errors.push(`summary: ${(err as Error).message}`)
  }
  return report
}
