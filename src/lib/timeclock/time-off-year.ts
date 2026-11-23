/**
 * Time off taken in a year, January to December, by type (owner, 17 November
 * 2026): what the approver is shown beside a request (Home's drawer and the
 * Approvals window) and what a person's page keeps as their record.
 *
 * Counted from the time entries (tc_entries, kind 'absence'): the history
 * that came from TSheets and everything approved in North Time, which writes
 * its hours there. Company holidays are not time off someone took, so they
 * are left out. Shown in hours, with days (8 hours each) beside them. What
 * is left is another matter: time-off-rules.ts, from Rippling's report.
 *
 * 2026 is partial: before North Time, some time off was never recorded in
 * TSheets (Tina added it at payroll), so the year reads low and says so.
 *
 * Plain data only: the reads are in time-off-year-data.ts.
 */

import { formatDuration } from './rounding'

export type OffKind = 'vacation' | 'sick' | 'unpaid' | 'other'

export const OFF_KINDS: readonly { key: OffKind; label: string; color: string }[] = [
  { key: 'vacation', label: 'Vacation', color: '#1D9E75' },
  { key: 'sick', label: 'Sick', color: '#D85A30' },
  { key: 'unpaid', label: 'Unpaid', color: '#888780' },
  { key: 'other', label: 'Other', color: '#6D5EF5' },
]
export const offKind = (key: OffKind) => OFF_KINDS.find(k => k.key === key)!

/** The year North Time started in: its count is partial. */
export const PARTIAL_YEAR = 2026
export const PARTIAL_NOTE = '2026 is partial: time off before North Time comes from TSheets and may be missing some days.'
export const DAY_SECONDS = 8 * 3600

/**
 * The type a time off job counts as; null for a company holiday, which is not
 * counted. Unpaid is the job's kind (Unpaid Time Off, Jury duty); the paid
 * ones go by name, and a paid job that is neither Vacation nor Sick is Other.
 */
export function offKindOf(job: { name: string; kind: string } | null | undefined): OffKind | null {
  if (!job) return 'other'
  const name = job.name.trim().toLowerCase()
  if (name === 'holiday') return null
  if (job.kind === 'unpaid') return 'unpaid'
  if (name.startsWith('sick')) return 'sick'
  if (name.startsWith('vacation')) return 'vacation'
  return 'other'
}

export interface OffEntry { date: string; seconds: number; kind: OffKind }

const round2 = (n: number) => Math.round(n * 100) / 100
/** "6 days", "1 day", "1.5 days", "0". */
export function daysLabel(seconds: number): string {
  const d = round2(seconds / DAY_SECONDS)
  return d === 0 ? '0' : `${d} day${d === 1 ? '' : 's'}`
}
/** "48h", "11.25h". */
export const hoursLabel = (seconds: number): string => `${round2(seconds / 3600)}h`
/**
 * "21h 45m", "0h": the hours as the portal writes every duration. The count's
 * main figure (owner, 17 November 2026), so a part of a day reads as what it
 * was (5h 45m) and not only as a share of a day (0.72).
 */
export const hmLabel = (seconds: number): string => (seconds > 0 ? formatDuration(seconds) : '0h')
/** "+16h", "+5h 45m": what a request adds, short. */
export const plusLabel = (seconds: number): string => `+${formatDuration(seconds).replace(/ 00m$/, '')}`
export const DAY_NOTE = 'A day is 8 hours.'

export interface YearLine {
  key: OffKind | 'all'
  label: string
  color: string | null
  seconds: number
  /** With the request being decided added (the same when it adds nothing here). */
  withSeconds: number
  /** The request being decided is of this type. */
  adds: boolean
}

export interface YearCount {
  year: number
  partial: boolean
  /** Vacation, Sick and Unpaid always; Other only when the year has some. */
  lines: YearLine[]
  total: YearLine
  /** January to December: the type taken most in the month, or null. */
  months: (OffKind | null)[]
  /** The month the request being decided falls in (0 to 11), or null. */
  month: number | null
}

/**
 * The year's count. `add`: a request still waiting, shown as what the year
 * becomes if it is approved (an approved one is already in the entries).
 */
export function yearCount(entries: readonly OffEntry[], year: number, add?: { kind: OffKind; seconds: number; date: string } | null): YearCount {
  const y = String(year)
  const sums: Record<OffKind, number> = { vacation: 0, sick: 0, unpaid: 0, other: 0 }
  const byMonth: Record<OffKind, number>[] = Array.from({ length: 12 }, () => ({ vacation: 0, sick: 0, unpaid: 0, other: 0 }))
  for (const e of entries) {
    if (!e.date.startsWith(y)) continue
    sums[e.kind] += e.seconds
    byMonth[Number(e.date.slice(5, 7)) - 1][e.kind] += e.seconds
  }
  const plus = add && add.date.startsWith(y) ? add : null
  const lines = OFF_KINDS.filter(k => k.key !== 'other' || sums.other > 0 || plus?.kind === 'other').map<YearLine>(k => ({
    key: k.key, label: k.label, color: k.color, seconds: sums[k.key],
    withSeconds: sums[k.key] + (plus?.kind === k.key ? plus.seconds : 0), adds: plus?.kind === k.key,
  }))
  const all = sums.vacation + sums.sick + sums.unpaid + sums.other
  return {
    year, partial: year === PARTIAL_YEAR, lines,
    total: { key: 'all', label: 'All time off', color: null, seconds: all, withSeconds: all + (plus?.seconds ?? 0), adds: !!plus },
    months: byMonth.map(m => {
      const top = OFF_KINDS.map(k => k.key).filter(k => m[k] > 0).sort((a, b) => m[b] - m[a])[0]
      return top ?? null
    }),
    month: add && add.date.startsWith(y) ? Number(add.date.slice(5, 7)) - 1 : null,
  }
}

export interface OffRunIn { date: string; seconds: number; kind: OffKind; source: string }
export interface OffRun { from: string; to: string; kind: OffKind; seconds: number; source: string; /** Each day's own hours, in order. */ days: { date: string; seconds: number }[] }

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
/** Under a range's dates: "8h 00m each day", or each day when they differ ("Mon 8h 00m, Tue 4h 00m"). Null for one day. */
export function perDayText(days: OffRun['days']): string | null {
  if (days.length < 2) return null
  if (days.every(d => d.seconds === days[0].seconds)) return `${hmLabel(days[0].seconds)} each day`
  return days.map(d => `${WEEKDAY[new Date(`${d.date}T00:00:00Z`).getUTCDay()]} ${hmLabel(d.seconds)}`).join(', ')
}

const nextWorkday = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`)
  do { d.setUTCDate(d.getUTCDate() + 1) } while (d.getUTCDay() === 0 || d.getUTCDay() === 6)
  return d.toISOString().slice(0, 10)
}

/**
 * The record's lines: days in a row (weekends skipped) of the same type from
 * the same place are one time off, "Aug 3 to 5". Newest first.
 */
export function offRuns(entries: readonly OffRunIn[]): OffRun[] {
  const byDay = new Map<string, OffRunIn>()
  for (const e of [...entries].sort((a, b) => a.date.localeCompare(b.date))) {
    const k = `${e.date}|${e.kind}|${e.source}`
    const had = byDay.get(k)
    byDay.set(k, had ? { ...had, seconds: had.seconds + e.seconds } : { ...e })
  }
  const runs: OffRun[] = []
  for (const e of byDay.values()) {
    const last = runs.findLast(r => r.kind === e.kind && r.source === e.source)
    if (last && (last.to === e.date || nextWorkday(last.to) === e.date)) { last.to = e.date; last.seconds += e.seconds; last.days.push({ date: e.date, seconds: e.seconds }) }
    else runs.push({ from: e.date, to: e.date, kind: e.kind, seconds: e.seconds, source: e.source, days: [{ date: e.date, seconds: e.seconds }] })
  }
  return runs.sort((a, b) => b.from.localeCompare(a.from))
}
