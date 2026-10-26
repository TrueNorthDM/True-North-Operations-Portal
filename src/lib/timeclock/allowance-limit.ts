/**
 * The hours allowance as a real limit (owner, 25 October 2026: "coloque um
 * limite de verdade"): nobody logs time past their allowance for the week or
 * month plus the extra hours approved for it. To work more, they ask for extra
 * hours first. People with no allowance have no limit.
 *
 * One reading for everyone who asks (the clock panel, the clock, Time
 * entries, Approvals and the safety job), the same as the allowance lines
 * have always counted: the entries of the window by their date, time off left
 * out, a running clock to now, against the allowance plus the extra hours
 * approved for periods that meet the window (allowance.ts decides with it).
 *
 * The running clock stops itself at the limit: the safety job every 5 minutes,
 * and any action or panel read that finds it past the limit first, at the
 * instant the limit was reached, the same way the 5-hour stop works.
 *
 * Not a "use server" file; the callers decide who may.
 */

import type { Db } from '@/lib/supabase/types'
import { allRows, db, loadClockySettings, type Catalog, type Directory } from './clocky-context'
import { stopAtLimit, stopIfDue, type AutoStop, type EntryRow, type LimitStop } from './clocky-store'
import { loadApprovedExtra } from './allowance-data'
import { loadPayTerms, type PayTerms } from './pay-terms'
import { entrySeconds } from './rounding'
import { safetyState, stopPoint, windowStart } from './safety'
import {
  allowanceRange, limitCheck, limitName, limitStopPoint, limitText, type AllowancePeriod, type AllowanceStatus, type CountedEntry,
} from './allowance'

export type Allowance = NonNullable<PayTerms['allowance']>

/** The person's allowance, or null: no allowance, no limit. */
export async function allowanceOf(personId: string): Promise<Allowance | null> {
  return (await loadPayTerms([personId])).get(personId)?.allowance ?? null
}

/** One allowance window of a person, with what counts in it. */
export interface LimitWindow {
  period: AllowancePeriod
  hours: number
  /** Extra hours approved for periods that meet the window. */
  extraHours: number
  from: string
  to: string
  counted: CountedEntry[]
}

/** The windows around `days` (each window read once), keyed by those days. */
export async function loadWindows(personId: string, allowance: Allowance, days: readonly string[], now: Date): Promise<Map<string, LimitWindow>> {
  const out = new Map<string, LimitWindow>()
  if (!days.length) return out
  const { weekStart } = await loadClockySettings()
  const ranges = new Map(days.map(d => [d, allowanceRange(d, allowance.period, weekStart)]))
  const from = [...ranges.values()].reduce((m, r) => (r.from < m ? r.from : m), '9999-12-31')
  const to = [...ranges.values()].reduce((m, r) => (r.to > m ? r.to : m), '0000-01-01')
  const [rows, extra] = await Promise.all([
    allRows<Pick<EntryRow, 'id' | 'entry_date' | 'started_at' | 'ended_at' | 'duration_seconds' | 'kind'>>((a, b) =>
      db().from('tc_entries').select('id, entry_date, started_at, ended_at, duration_seconds, kind').eq('person_id', personId)
        .gte('entry_date', from).lte('entry_date', to).neq('kind', 'absence').order('id').range(a, b), 'Hours could not be read'),
    // Unread is not "none": it would refuse hours that extra hours allowed.
    loadApprovedExtra([personId], from, to),
  ])
  for (const [day, r] of ranges) {
    out.set(day, {
      period: allowance.period, hours: allowance.hours, extraHours: extra(personId, r.from, r.to), ...r,
      counted: rows.filter(e => e.entry_date >= r.from && e.entry_date <= r.to).map(e => ({ id: e.id, seconds: entrySeconds(e, now) })),
    })
  }
  return out
}

/** The window as it stands, without the entries in `exclude`. */
export const statusOf = (w: LimitWindow, exclude: readonly number[] = []): AllowanceStatus =>
  limitCheck({ counted: w.counted, exclude, adding: 0, hours: w.hours, extraHours: w.extraHours }).status

const wordsOf = (w: LimitWindow, s: AllowanceStatus) => ({ period: w.period, from: w.from, limit: s.limit, extraHours: w.extraHours })

/**
 * A change of someone's hours against their limit: what it adds, by day, and
 * the entries it replaces. null when it fits (or they have no allowance), else
 * the sentence. `name` is the person's when someone else changes their hours.
 */
export async function limitRefusal(personId: string, change: { add: readonly { day: string; seconds: number }[]; exclude?: readonly number[] }, now: Date, name: string | null = null): Promise<string | null> {
  const adds = change.add.filter(a => a.seconds > 0)
  if (!adds.length) return null
  const allowance = await allowanceOf(personId)
  if (!allowance) return null
  const windows = await loadWindows(personId, allowance, adds.map(a => a.day), now)
  const seen = new Set<string>()
  for (const w of windows.values()) {
    if (seen.has(w.from)) continue
    seen.add(w.from)
    const adding = adds.filter(a => a.day >= w.from && a.day <= w.to).reduce((s, a) => s + a.seconds, 0)
    const r = limitCheck({ counted: w.counted, exclude: change.exclude, adding, hours: w.hours, extraHours: w.extraHours })
    if (r.refused) return limitText({ ...wordsOf(w, r.status), left: r.status.left, name })
  }
  return null
}

/** Where a running clock meets the limit, and whether it has: its window is the one of the day it started. */
export function limitStopIn(w: LimitWindow, e: Pick<EntryRow, 'id' | 'started_at' | 'started_at_real'>, now: Date): { at: { real: string; recorded: string }; due: boolean; allowance: string } | null {
  if (!e.started_at) return null
  const s = statusOf(w, [e.id])
  const at = limitStopPoint(e.started_at, s.left, e.started_at_real)
  return { at, due: now.getTime() >= Date.parse(at.real), allowance: limitName(wordsOf(w, s)) }
}

export type ClockStop =
  | { kind: 'safety'; stop: AutoStop }
  | { kind: 'limit'; stop: LimitStop; words: { period: AllowancePeriod; from: string; limit: number; extraHours: number }; text: string }

/**
 * Stop a running clock if its 5-hour window ran out or it reached the
 * person's allowance, whichever came first, at that instant. `allowance` may
 * be given when the caller already read it (the safety job). null when the
 * clock goes on, or another write ended it first.
 */
export async function stopClockIfDue(c: Db, e: EntryRow, now: Date, dir: Directory, catalog: Catalog, allowance?: Allowance | null): Promise<ClockStop | null> {
  if (e.ended_at !== null || e.kind !== 'clock' || !e.started_at) return null
  const al = allowance === undefined ? await allowanceOf(e.person_id) : allowance
  if (al) {
    const w = (await loadWindows(e.person_id, al, [e.entry_date], now)).get(e.entry_date)!
    const lim = limitStopIn(w, e, now)
    const ws = windowStart(e)
    const safetyAt = ws && safetyState(ws, now).due ? Date.parse(stopPoint(ws, e.started_at).real) : null
    if (lim?.due && (safetyAt === null || Date.parse(lim.at.real) <= safetyAt)) {
      const stop = await stopAtLimit(c, e, lim.at, dir.zoneOf(e.person_id), catalog, lim.allowance)
      if (!stop) return null
      const s = statusOf(w, [e.id])
      const words = wordsOf(w, s)
      return { kind: 'limit', stop, words, text: limitText({ ...words, left: 0 }) }
    }
  }
  const stop = await stopIfDue(c, e, now, dir, catalog)
  return stop ? { kind: 'safety', stop } : null
}
