/**
 * Working hours (owner, 30 October 2026): each person sets their own in Agenda
 * settings, in their own time zone, with several blocks a day (Monday 7 to 11
 * AM and 1 to 6 PM) and a day copied to others. Find a time and booking links
 * only offer times inside them. Stored in agenda_person_settings.working_hours
 * (migration 135) as minutes from midnight by ISO weekday. Pure.
 */

import { instantOf } from './time'

export type Block = [number, number]
/** "1" Monday to "7" Sunday; a missing day is not a working day. */
export type WorkingHours = Partial<Record<Weekday, Block[]>>
export type Weekday = '1' | '2' | '3' | '4' | '5' | '6' | '7'

export const WEEKDAYS: readonly Weekday[] = ['1', '2', '3', '4', '5', '6', '7']
export const DAY_NAMES: Record<Weekday, string> = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 7: 'Sunday' }
export const DEFAULT_HOURS: WorkingHours = { 1: [[540, 1080]], 2: [[540, 1080]], 3: [[540, 1080]], 4: [[540, 1080]], 5: [[540, 1080]] }
const STEP = 30

/** Blocks sorted, on the half hour, inside the day, and joined where they touch or overlap. */
export function tidy(blocks: readonly Block[]): Block[] {
  const ok = blocks
    .filter(b => Array.isArray(b) && b.length === 2 && Number.isFinite(b[0]) && Number.isFinite(b[1]))
    .map(([a, b]): Block => [Math.max(0, Math.round(a / STEP) * STEP), Math.min(1440, Math.round(b / STEP) * STEP)])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0])
  const out: Block[] = []
  for (const b of ok) {
    const last = out[out.length - 1]
    if (last && b[0] <= last[1]) last[1] = Math.max(last[1], b[1])
    else out.push([b[0], b[1]])
  }
  return out
}

/** Whatever is stored, as working hours: unknown days and broken blocks are dropped; nothing usable is the default. */
export function readHours(json: unknown): WorkingHours {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return DEFAULT_HOURS
  const out: WorkingHours = {}
  for (const d of WEEKDAYS) {
    const v = (json as Record<string, unknown>)[d]
    if (!Array.isArray(v)) continue
    const blocks = tidy(v as Block[])
    if (blocks.length) out[d] = blocks
  }
  return out
}

/** What a person saves: refused when a block ends before it starts or overlaps another, so nothing is changed behind their back. */
export function checkHours(input: unknown): { ok: true; hours: WorkingHours } | { ok: false; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Those working hours could not be read.' }
  const out: WorkingHours = {}
  for (const d of WEEKDAYS) {
    const v = (input as Record<string, unknown>)[d]
    if (v == null) continue
    if (!Array.isArray(v) || v.length > 6) return { ok: false, error: `${DAY_NAMES[d]}: those hours could not be read.` }
    const blocks = [...(v as Block[])].sort((a, b) => a[0] - b[0])
    for (let i = 0; i < blocks.length; i++) {
      const [a, b] = blocks[i]
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b > 1440 || a % STEP || b % STEP) return { ok: false, error: `${DAY_NAMES[d]}: pick times on the hour or half hour.` }
      if (b <= a) return { ok: false, error: `${DAY_NAMES[d]}: each block has to end after it starts.` }
      if (i > 0 && a < blocks[i - 1][1]) return { ok: false, error: `${DAY_NAMES[d]}: two blocks overlap.` }
    }
    if (blocks.length) out[d] = blocks.map(([a, b]) => [a, b])
  }
  return { ok: true, hours: out }
}

/** One day's blocks copied to other days (each copied day is switched on). */
export function copyDay(hours: WorkingHours, from: Weekday, to: readonly Weekday[]): WorkingHours {
  const src = hours[from]
  if (!src?.length) return hours
  const out: WorkingHours = { ...hours }
  for (const d of to) if (d !== from) out[d] = src.map(([a, b]) => [a, b])
  return out
}

const isoWeekday = (dateISO: string): Weekday => String(((new Date(`${dateISO}T12:00:00Z`).getUTCDay() + 6) % 7) + 1) as Weekday
const addDays = (dateISO: string, n: number) => new Date(Date.parse(`${dateISO}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10)

/**
 * The working intervals (UTC milliseconds) that touch [fromMs, toMs), from the
 * person's own days: one local day can fall on two Washington days.
 */
export function workingIntervals(hours: WorkingHours, zone: string, fromMs: number, toMs: number): [number, number][] {
  const out: [number, number][] = []
  const first = new Date(fromMs - 864e5).toISOString().slice(0, 10)
  const days = Math.ceil((toMs - fromMs) / 864e5) + 3
  for (let i = 0; i < days; i++) {
    const day = addDays(first, i)
    for (const [a, b] of hours[isoWeekday(day)] ?? []) {
      const s = instantOf(day, a, zone), e = instantOf(day, b, zone)
      if (e > fromMs && s < toMs) out.push([Math.max(s, fromMs), Math.min(e, toMs)])
    }
  }
  return out.sort((x, y) => x[0] - y[0])
}
