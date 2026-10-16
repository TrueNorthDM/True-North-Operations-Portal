/**
 * The safety net's job (design handoff of 16 October 2026, README "Rules" 4
 * and 5): every 5 minutes, from the server's crontab (/api/cron/clocky-safety).
 *
 * For every clock still running:
 *   - at 4h 30m into its window (since the clock in, across switches, or since
 *     the last "Keep going"): "Still working?" in the bell, once per window,
 *     logged for Clock safety;
 *   - at 5h 00m: Clocky ends the entry at the 5-hour mark (recorded on the
 *     quarter hour, the real mark kept), logs it, and tells the person in the
 *     bell and by the one email, "Your clock stopped by itself".
 *
 * Clocks still open from QuickBooks Time come in through the import as running
 * clocks with no window of their own. They are handled here too, the same way,
 * counting from their start: one job for every clock, so the rule cannot drift
 * between two places, and a clock that arrives open days late is closed at its
 * 5-hour mark the first time the job sees it ("as soon as Clocky notices",
 * SPEC 1L). The import, for its part, leaves alone an entry Clocky has changed
 * (changed_here_at), so the next import cannot open it again.
 *
 * Once a day it also writes the Super Admins' line about yesterday's
 * automatic clock-outs (their daily summary).
 */

import type { Db } from '@/lib/supabase/types'
import { notifyClockyAutoStops } from '@/lib/notifications/run'
import { allRows, loadCatalog, loadDirectory } from './clocky-context'
import { stopIfDue, type EntryRow } from './clocky-store'
import { announceStillWorking, announceStop } from './clocky-notify'
import { safetyState, sessionStart, windowStart } from './safety'

export interface SafetyRunReport {
  running: number
  warned: number
  stopped: number
  summary: string | null
  errors: string[]
}

export async function runClockSafety(c: Db, opts: { now?: Date; origin: string }): Promise<SafetyRunReport> {
  const now = opts.now ?? new Date()
  const report: SafetyRunReport = { running: 0, warned: 0, stopped: 0, summary: null, errors: [] }
  const [dir, catalog] = await Promise.all([loadDirectory(), loadCatalog()])
  const running = await allRows<EntryRow>((a, b) => c.from('tc_entries').select('*').eq('kind', 'clock').is('ended_at', null)
    .not('started_at', 'is', null).order('id').range(a, b), 'The running clocks could not be read')
  report.running = running.length

  for (const e of running) {
    try {
      const ws = windowStart(e)
      if (!ws) continue
      const st = safetyState(ws, now)
      if (st.due) {
        const stop = await stopIfDue(c, e, now, dir, catalog)
        if (stop) {
          report.stopped++
          await announceStop(stop, opts.origin, now, c)
        }
        continue
      }
      if (!st.warn) continue
      // Warned once per window: the event's key is the window.
      const { data, error } = await c.from('tc_safety_events').upsert({
        person_id: e.person_id, entry_id: e.id, kind: 'warned', at: now.toISOString(), window_started_at: ws,
        session_started_at: sessionStart(e), jobcode_id: e.jobcode_id,
      }, { onConflict: 'person_id,kind,window_started_at', ignoreDuplicates: true }).select('id')
      if (error) throw new Error(error.message)
      if (!data?.length) continue
      report.warned++
      await announceStillWorking({ personId: e.person_id, windowStartedAt: ws }, c)
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
