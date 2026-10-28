/**
 * Time entries, the pure half (design handoff of 16 October 2026, Time
 * Entries.dc.html): the period ranges and their labels, the list's columns
 * and day groups, the totals, the 3E check line, the week grid's cells, and
 * the day timeline's arithmetic. No React and no server: the screens draw
 * what these answer, and model.test.ts holds them to the prototype.
 *
 * Every duration and total shown is a multiple of 15 minutes (README "Rules"
 * 1); the formatters in lib/timeclock/rounding.ts round them. The one place a
 * typed, unrounded duration is written out is the 3E line that says what it
 * is recorded as ("2h 20m is recorded as 2h 15m").
 */

import { addDays, gridPeriod, monthEnd, monthStart, type AnchorChange } from '@/lib/timeclock/periods'
import { dayLabel, minutesLabel, monthLong, monthYear, rangeLabel, rangeLabelYear, weekdayShort } from '@/lib/timeclock/format'
import { formatClock, formatDuration, parseDuration, roundSeconds, runningSeconds, QUARTER } from '@/lib/timeclock/rounding'
import { DURATION_FORMAT, END_AFTER_START, OVER_24H, DAY_SECONDS, LONG_ENTRY_SECONDS } from '@/lib/timeclock/entry-rules'
import { SHORTEN_ONLY } from '@/lib/timeclock/scope'
import type { ClockChoice, EntryView } from '@/lib/timeclock/clocky-types'

// ── Periods ─────────────────────────────────────────────────────────────────

/** Day | Week | Pay period | Month. */
export type PeriodKind = 'day' | 'week' | 'pp' | 'month'

const weekday = (iso: string): number => new Date(`${iso}T00:00:00Z`).getUTCDay()

/** The Sunday that starts the week a day is in (the prototype's weeks run Sunday to Saturday). */
export const weekStartOf = (iso: string): string => addDays(iso, -weekday(iso))

/** The days a period covers, from the day it is anchored on. */
export function periodRange(kind: PeriodKind, anchor: string, anchors: readonly AnchorChange[]): { from: string; to: string } {
  if (kind === 'day') return { from: anchor, to: anchor }
  if (kind === 'month') return { from: monthStart(anchor), to: monthEnd(anchor) }
  if (kind === 'pp') {
    const p = gridPeriod(anchor, anchors)
    if (p) return { from: p.start, to: p.end }
  }
  const from = weekStartOf(anchor)
  return { from, to: addDays(from, 6) }
}

/** The previous or next period's anchor: the day before it starts, or the day after it ends. */
export function shiftAnchor(kind: PeriodKind, anchor: string, by: -1 | 1, anchors: readonly AnchorChange[]): string {
  const r = periodRange(kind, anchor, anchors)
  return by > 0 ? addDays(r.to, 1) : addDays(r.from, -1)
}

/** The range next to the arrows: "Thu, Oct 15, 2026", "Oct 11 to 17, 2026", "October 2026". */
export function rangeText(kind: PeriodKind, from: string, to: string): string {
  if (kind === 'day') return `${dayLabel(from)}, ${from.slice(0, 4)}`
  if (kind === 'month') return monthYear(from)
  return rangeLabelYear(from, to)
}

/** The first words of the totals strip: "This week", "Week", "This pay period", "October", "Thu, Oct 15". */
export function totalsLabel(kind: PeriodKind, anchor: string, from: string, to: string, today: string): string {
  const inNow = today >= from && today <= to
  if (kind === 'day') return dayLabel(anchor)
  if (kind === 'week') return inNow ? 'This week' : 'Week'
  if (kind === 'pp') return inNow ? 'This pay period' : 'Pay period'
  return monthLong(anchor)
}

/** The calendar menu: four weeks back, this week (marked), and next week. Picking one lands on its Thursday. */
export function calendarWeeks(today: string): { label: string; anchor: string; current: boolean }[] {
  const start = weekStartOf(today)
  return [-4, -3, -2, -1, 0, 1].map(i => {
    const a = addDays(start, i * 7)
    return { label: rangeLabel(a, addDays(a, 6)), anchor: addDays(a, 4), current: i === 0 }
  })
}

/** "America/New_York" is "New York": the list note's "Times in your time zone (New York)". */
export const zoneCity = (zone: string): string => (zone.split('/').pop() ?? zone).replace(/_/g, ' ')

// ── Rows and totals ─────────────────────────────────────────────────────────

/** Hours that count: entries, never time off, corrections or time off requests (README "Rules"). */
export const isWork = (r: EntryView): boolean => r.rowType === 'entry' && r.kind !== 'absence'

/** A row's seconds now: a running entry counts from its recorded start to now rounded. */
export const liveSeconds = (r: EntryView, nowMs: number): number =>
  r.running && r.start ? runningSeconds(r.start, new Date(nowMs)) : r.seconds

export interface Totals {
  seconds: number
  billable: number
  nonBillable: number
  entries: number
  byClient: { client: string; seconds: number }[]
}

/** The totals strip and the side cards, from the rows on screen. */
export function totalsOf(rows: readonly EntryView[], nowMs: number): Totals {
  const work = rows.filter(isWork)
  const seconds = work.reduce((s, r) => s + liveSeconds(r, nowMs), 0)
  const billable = work.filter(r => r.billable === 'yes').reduce((s, r) => s + liveSeconds(r, nowMs), 0)
  const byClient = new Map<string, number>()
  for (const r of work) byClient.set(r.client, (byClient.get(r.client) ?? 0) + liveSeconds(r, nowMs))
  return {
    seconds, billable, nonBillable: seconds - billable, entries: work.length,
    byClient: [...byClient.entries()].map(([client, s]) => ({ client, seconds: s })).sort((a, b) => b.seconds - a.seconds),
  }
}

/** The bar colour of a client in "Hours by client" (and the timeline's blocks). */
export function clientColor(client: string): string {
  if (client === 'True North') return '#2b4f86'
  if (client === 'i7 Marketing') return '#1E7D7F'
  if (client === 'HFA') return '#d9a400'
  return '#5b6b82'
}

/** How a row is named on the timeline and in the overlap fix: its saved combination, else the short job. */
export function nameFor(r: Pick<EntryView, 'jobcodeId' | 'activity' | 'short'>, combos: readonly ClockChoice[]): string {
  const c = combos.find(x => x.jobcodeId === r.jobcodeId && x.activity === r.activity && x.name)
  return c?.name ?? r.short
}

export interface DayGroup { date: string; label: string; seconds: number; people: number; rows: EntryView[] }

/**
 * The list's day groups, newest day first. In "All" a day's rows run by
 * person, then by start; duration-only rows sit at the end.
 */
export function groupByDay(rows: readonly EntryView[], all: boolean, nowMs: number): DayGroup[] {
  const dates = [...new Set(rows.map(r => r.date))].sort().reverse()
  return dates.map(date => {
    const d = rows.filter(r => r.date === date).sort((a, b) =>
      (all ? a.personName.localeCompare(b.personName) : 0)
      || ((a.start ? Date.parse(a.start) : 9e15) - (b.start ? Date.parse(b.start) : 9e15)))
    return {
      date,
      label: dayLabel(date),
      seconds: d.filter(isWork).reduce((s, r) => s + liveSeconds(r, nowMs), 0),
      people: new Set(d.map(r => r.personId)).size,
      rows: d,
    }
  })
}

/** "Over 10 hours" marks the duration cell (" !", amber). */
export const overTen = (r: EntryView, nowMs: number): boolean => isWork(r) && liveSeconds(r, nowMs) > LONG_ENTRY_SECONDS

// ── The list's columns (3A, the Columns menu) ──────────────────────────────

export type ColumnKey = 'person' | 'time' | 'duration' | 'job' | 'client' | 'division' | 'place' | 'company' | 'project' | 'activity' | 'billable' | 'code' | 'notes' | 'status'

// Widths measured from the text they hold plus the cell's 24 px of padding (owner,
// 28 October 2026: no empty space after Time in to out): "10:00 AM to 11:30 AM" is
// 137 px, "True North Internal" 128, "Seeker Outreach" 109, Open + Edited 104. With
// Client, Division and Project the list fits the 1278 px inside its border beside the summary.
export const COLUMNS: readonly { key: ColumnKey; label: string; width: number }[] = [
  { key: 'person', label: 'Person', width: 170 },
  { key: 'time', label: 'Time in to out', width: 164 },
  { key: 'duration', label: 'Duration', width: 86 },
  { key: 'job', label: 'Job', width: 230 },
  // The job's path in its own columns (the 2026 structure: Client, Division, Project). A TSheets job has no division.
  { key: 'client', label: 'Client', width: 150 },
  { key: 'division', label: 'Division', width: 130 },
  { key: 'place', label: 'Project', width: 140 },
  // The TSheets i7 fields, named so they are not taken for the 2026 Project.
  { key: 'company', label: 'Company (TSheets)', width: 130 },
  { key: 'project', label: 'Project (TSheets)', width: 130 },
  { key: 'activity', label: 'Activity', width: 150 },
  { key: 'billable', label: 'Billable', width: 80 },
  { key: 'code', label: 'i7 Code', width: 100 },
  { key: 'notes', label: 'Notes', width: 110 },
  { key: 'status', label: 'Status', width: 128 },
]

/** What shows until the person changes it: the job in Client, Division and Project (owner, 28 October 2026); the whole path, the TSheets fields and i7 Code hidden. */
export const DEFAULT_COLUMNS: Record<ColumnKey, boolean> = {
  person: true, time: true, duration: true, job: false, client: true, division: true, place: true, company: false, project: false,
  activity: true, billable: true, code: false, notes: true, status: true,
}

/** The width of the actions column, and the columns' grid. */
export const ACTIONS_WIDTH = 140

/** The TSheets entries' own fields: nothing to show on a 2026 entry, whose job is its Client, Division and Project. */
export const TSHEETS_COLUMNS: readonly ColumnKey[] = ['company', 'project', 'code']

/** Whether any entry on screen was recorded on a TSheets job (before the switch date). */
export const hasTsheetsRows = (rows: readonly Pick<EntryView, 'rowType' | 'structure'>[]): boolean =>
  rows.some(r => r.rowType !== 'time_off' && r.structure !== 2)

/**
 * The columns the Columns menu offers: Person only in All, and the TSheets fields only when
 * a TSheets entry is on screen (owner, 28 October 2026).
 */
export function offeredColumns(all: boolean, tsheets: boolean) {
  return COLUMNS.filter(c => (c.key !== 'person' || all) && (tsheets || !TSHEETS_COLUMNS.includes(c.key)))
}

export function visibleColumns(cols: Record<ColumnKey, boolean>, all: boolean, tsheets = true) {
  return offeredColumns(all, tsheets).filter(c => cols[c.key])
}

export function gridTemplate(vis: readonly { key: ColumnKey; width: number }[]): string {
  return vis.map(c => (c.key === 'job' ? `minmax(${c.width}px,1.4fr)` : c.key === 'place' ? `minmax(${c.width}px,1.2fr)` : c.key === 'client' || c.key === 'division' ? `minmax(${c.width}px,.8fr)` : c.key === 'notes' ? `minmax(${c.width}px,1fr)` : `${c.width}px`)).join(' ') + ` ${ACTIONS_WIDTH}px`
}

export const minWidth = (vis: readonly { width: number }[]): number => vis.reduce((a, c) => a + c.width, ACTIONS_WIDTH)

// ── Times in the forms ──────────────────────────────────────────────────────

/** The 96 quarter hours of a day, in minutes: the Start and End pickers. */
export const QUARTERS: readonly number[] = Array.from({ length: 96 }, (_, i) => i * 15)

/** "HH:MM" on a 24-hour clock: what the actions take. */
export const hhmmOf = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/** A typed duration as typed, not rounded: "2h 20m" (only the 3E line that says how it is recorded). */
export function exactDuration(seconds: number): string {
  const m = Math.round(Math.max(0, seconds) / 60)
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}

/** What a User may keep of their own entry: inside what was recorded. */
export interface Bounds {
  /** Start and end in minutes of the day; end null while running. */
  start: number | null
  end: number | null
  /** A duration-only entry: no more than this. */
  seconds: number | null
}

export interface CheckInput {
  type: 'range' | 'dur'
  start: number
  /** Minutes of the day, or 'now' for a running entry. */
  end: number | 'now'
  /** The person's minutes of the day now (a running entry's end). */
  nowMinutes: number
  durText: string
  /** The red overlap sentence, already written (it needs instants and the person's zone). */
  overlapText: string | null
  bounds: Bounds | null
}

export interface Check { text: string; bad: boolean; seconds: number; shortenOnly: boolean }

/** The seconds a form's times make. */
export function formSeconds(x: Pick<CheckInput, 'type' | 'start' | 'end' | 'nowMinutes' | 'durText'>): number {
  if (x.type === 'dur') return parseDuration(x.durText)
  const end = x.end === 'now' ? x.nowMinutes : x.end
  return (end - x.start) * 60
}

/** 3E's live check line under the times, in the prototype's order. */
export function checkLine(x: CheckInput): Check {
  const d = formSeconds(x)
  const out = (text: string, bad: boolean, shortenOnly = false): Check => ({ text, bad, seconds: d, shortenOnly })
  if (x.type === 'range' && !(d > 0)) return out(END_AFTER_START, true)
  if (x.type === 'dur' && !(d > 0)) return out(DURATION_FORMAT, true)
  if (d > DAY_SECONDS) return out(OVER_24H, true)
  if (x.overlapText) return out(x.overlapText, true)
  const b = x.bounds
  if (b) {
    const longer = b.seconds !== null
      ? d > b.seconds
      : (b.start !== null && x.start < b.start) || (b.end !== null && x.end !== 'now' && x.end > b.end) || (b.end !== null && x.end === 'now')
    if (longer) return out(SHORTEN_ONLY, true, true)
  }
  if (x.type === 'dur' && d % QUARTER) return out(`${exactDuration(d)} is recorded as ${formatDuration(d)}, the nearest 15 minutes. No overlap.`, false)
  return out(`${formatDuration(d)}. No overlap.`, false)
}

// ── The week grid (3B) ──────────────────────────────────────────────────────

export const gridRowKey = (jobcodeId: number | null, activity: string): string => `${jobcodeId ?? ''}|${activity}`
export const gridEditKey = (rowKey: string, date: string): string => `${rowKey}#${date}`

/** A row's source: an entry of the week or a combination added with "Add row". */
export interface GridSource { key: string; jobcodeId: number | null; path: string; activity: string; fields: Record<string, string> }

/** One entry, as the grid reads it. */
export interface GridEntry { rowKey: string; date: string; seconds: number; clocked: boolean; locked: boolean }

export interface GridCell {
  date: string
  /** Read only: a clocked entry is in it, the day is locked, or the viewer only reads. */
  ro: boolean
  clock: boolean
  locked: boolean
  text: string
  invalid: boolean
}

export interface GridRow { key: string; source: GridSource; cells: GridCell[]; total: number }

export interface GridModel {
  rows: GridRow[]
  dayTotals: number[]
  /** Per day: a cell that cannot be read, or more than 24 hours. */
  bad: ('fmt' | 'over' | null)[]
  error: string | null
  week: number
}

/**
 * The grid as the prototype computes it: read-only cells carry their clocked
 * hours, typed cells parse "2:30" or "2.5", a day over 24 hours turns red and
 * stops Save, and so does a cell that cannot be read.
 */
export function buildGrid(x: {
  days: readonly string[]
  sources: readonly GridSource[]
  entries: readonly GridEntry[]
  edits: Readonly<Record<string, string>>
  editable: boolean
}): GridModel {
  const dayLocked = (d: string) => x.entries.some(e => e.date === d && e.locked)
  const dayTotals = x.days.map(() => 0)
  const bad: ('fmt' | 'over' | null)[] = x.days.map(() => null)
  const rows: GridRow[] = x.sources.map(source => {
    let total = 0
    const cells = x.days.map((date, i): GridCell => {
      const here = x.entries.filter(e => e.rowKey === source.key && e.date === date)
      const clocked = here.filter(e => e.clocked)
      const typed = here.filter(e => !e.clocked)
      const locked = dayLocked(date)
      if (clocked.length || locked || !x.editable) {
        const v = here.reduce((s, e) => s + e.seconds, 0)
        total += v
        dayTotals[i] += v
        return { date, ro: true, clock: clocked.length > 0, locked, text: v ? formatClock(v) : '', invalid: false }
      }
      const own = typed.reduce((s, e) => s + e.seconds, 0)
      const edited = x.edits[gridEditKey(source.key, date)]
      const text = edited ?? (typed.length ? formatClock(own) : '')
      const v = parseDuration(text)
      if (Number.isNaN(v)) bad[i] = 'fmt'
      else { total += v; dayTotals[i] += v }
      return { date, ro: false, clock: false, locked: false, text, invalid: Number.isNaN(v) }
    })
    return { key: source.key, source, cells, total }
  })
  dayTotals.forEach((t, i) => { if (t > DAY_SECONDS) bad[i] = 'over' })
  const at = bad.findIndex(Boolean)
  const error = at < 0 ? null
    : bad[at] === 'over'
      ? `More than 24 hours on ${weekdayShort(x.days[at])}. A day has 24 hours; fix the cells in red.`
      : `Use "2:30" or "2.5" in ${weekdayShort(x.days[at])}.`
  return { rows, dayTotals, bad, error, week: dayTotals.reduce((a, b) => a + b, 0) }
}

/** What Save sends: the typed cells, per row, that the grid lets the viewer type into. */
export function gridChanges(model: GridModel, edits: Readonly<Record<string, string>>): { source: GridSource; cells: Record<string, string> }[] {
  const out: { source: GridSource; cells: Record<string, string> }[] = []
  for (const r of model.rows) {
    const cells: Record<string, string> = {}
    for (const c of r.cells) {
      const k = gridEditKey(r.key, c.date)
      if (!c.ro && k in edits) cells[c.date] = edits[k]
    }
    if (Object.keys(cells).length) out.push({ source: r.source, cells })
  }
  return out
}

// ── The day timeline (3C) ───────────────────────────────────────────────────

/** 64 pixels to the hour, as drawn. */
export const PX_PER_HOUR = 64

/** "6 AM to 10 PM" or "24 h", in seconds from the viewer's midnight. */
export const axisOf = (full: boolean): { from: number; to: number } => (full ? { from: 0, to: DAY_SECONDS } : { from: 6 * 3600, to: 22 * 3600 })

export const xOf = (seconds: number, axisFrom: number): number => ((seconds - axisFrom) / 3600) * PX_PER_HOUR
export const secondsAt = (px: number, axisFrom: number): number => axisFrom + (px / PX_PER_HOUR) * 3600

/** Every drag snaps to the quarter hour. */
export const snapQuarter = (seconds: number): number => Math.round(seconds / QUARTER) * QUARTER

/** Drag on empty space: at least a quarter hour, whichever way the pointer goes. */
export function createSpan(t0: number, t: number): { s: number; e: number } {
  return { s: Math.min(t0, t), e: Math.max(t0 + QUARTER, t) }
}

/** Drag a block (move), or its left or right edge; an edge never passes the other within a quarter hour. */
export function dragSpan(mode: 'move' | 'l' | 'r', orig: { s: number; e: number }, dt: number): { s: number; e: number } {
  if (mode === 'move') return { s: orig.s + dt, e: orig.e + dt }
  if (mode === 'l') return { s: Math.min(orig.s + dt, orig.e - QUARTER), e: orig.e }
  return { s: orig.s, e: Math.max(orig.e + dt, orig.s + QUARTER) }
}

/** The hour labels along the top: "6 AM", "7 AM", "12 PM". */
export function hourTicks(axis: { from: number; to: number }): { x: number; label: string }[] {
  const out: { x: number; label: string }[] = []
  for (let t = axis.from; t < axis.to; t += 3600) out.push({ x: xOf(t, axis.from), label: minutesLabel(t / 60).replace(':00', '') })
  return out
}

/** Seconds from the viewer's midnight to an instant (negative before it, more than a day after). */
export const axisSeconds = (iso: string, midnightIso: string): number => (Date.parse(iso) - Date.parse(midnightIso)) / 1000

/** Rounded seconds as the grid and the panels write them, re-exported for the screens. */
export { formatClock, formatDuration, roundSeconds }
