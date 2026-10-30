/**
 * Find a time (owner, 30 October 2026; the approved mockup's panel beside the
 * drawer): when everyone invited is free, on a Washington DC day. Each person
 * comes with their working intervals and their busy ones (all their connected
 * accounts, portal events, time off, holidays), as UTC milliseconds. Pure: the
 * browser runs it on what the server sent for the next weeks.
 */

import { DC, instantOf } from './time'

export interface Avail { id: string; work: [number, number][]; busy: [number, number][] }
export interface DayRow { id: string; work: [number, number][]; busy: [number, number][] }

/** The day's window in Washington: 6 AM to 8 PM. */
export const WINDOW: readonly [number, number] = [360, 1200]
const STEP = 30

const dayStart = (day: string) => instantOf(day, 0, DC)
const toMin = (day: string, ms: number) => Math.round((ms - dayStart(day)) / 60000)
const clip = (xs: [number, number][], lo: number, hi: number): [number, number][] =>
  xs.map(([a, b]): [number, number] => [Math.max(a, lo), Math.min(b, hi)]).filter(([a, b]) => b > a)

/** One person's day in Washington minutes, for the bars. */
export function dayRow(p: Avail, day: string): DayRow {
  const lo = dayStart(day), hi = instantOf(day, 1440, DC)
  const m = (xs: [number, number][]) => clip(xs, lo, hi).map(([a, b]): [number, number] => [toMin(day, a), toMin(day, b)])
  return { id: p.id, work: m(p.work), busy: m(p.busy) }
}

export type Why = 'Busy' | 'Outside working hours'

/** Why a person cannot make [start, start + dur) on a day, or null when they can. */
export function whyNot(r: DayRow, start: number, dur: number): Why | null {
  const end = start + dur
  if (!r.work.some(([a, b]) => start >= a && end <= b)) return 'Outside working hours'
  if (r.busy.some(([a, b]) => start < b && end > a)) return 'Busy'
  return null
}

export interface DayAnswer {
  rows: DayRow[]
  /** Starts (Washington minutes) when everyone is free. */
  allFree: number[]
  /** When nobody time fits everyone: the starts with the most people free. */
  best: { start: number; free: number; missing: { id: string; why: Why }[] }[]
}

export function findDay(people: readonly Avail[], day: string, dur: number, limit = 9): DayAnswer {
  const rows = people.map(p => dayRow(p, day))
  const starts: { start: number; free: number; missing: { id: string; why: Why }[] }[] = []
  for (let s = WINDOW[0]; s + dur <= WINDOW[1]; s += STEP) {
    const missing = rows.flatMap(r => { const w = whyNot(r, s, dur); return w ? [{ id: r.id, why: w }] : [] })
    starts.push({ start: s, free: rows.length - missing.length, missing })
  }
  const allFree = rows.length ? starts.filter(x => !x.missing.length).map(x => x.start) : []
  const top = allFree.length ? 0 : Math.max(0, ...starts.map(x => x.free))
  return { rows, allFree, best: top > 0 ? starts.filter(x => x.free === top).slice(0, limit) : [] }
}

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10)
const weekend = (d: string) => { const w = new Date(`${d}T12:00:00Z`).getUTCDay(); return w === 0 || w === 6 }

/** The next times everyone is free after a day, on weekdays within four weeks. */
export function nextFree(people: readonly Avail[], after: string, dur: number, n = 3, days = 28): { day: string; start: number }[] {
  const out: { day: string; start: number }[] = []
  for (let i = 1; i <= days && out.length < n; i++) {
    const day = addDays(after, i)
    if (weekend(day)) continue
    for (const start of findDay(people, day, dur).allFree) { out.push({ day, start }); if (out.length >= n) break }
  }
  return out
}
