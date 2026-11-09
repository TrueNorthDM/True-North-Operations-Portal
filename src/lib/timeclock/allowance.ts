/**
 * The hours allowance (Clocky part 2, README_PART2 "Allowance & extra hours"):
 * the hours a person may work in a week or a month.
 *
 *   ok     under 90% of the allowance (plus approved extra hours)
 *   near   90% or more ("12h left this month")
 *   over   past it ("3h over your allowance, not approved")
 *
 * Since 25 October 2026 it is a real limit (owner: "coloque um limite de
 * verdade"): nobody logs time past the allowance plus the extra hours approved
 * for that week or month. The clock will not start at the limit, a running
 * clock stops by itself when it reaches it, and adding or lengthening time
 * past it is refused, whoever does it: the limit is the person's. To work
 * more, they ask for extra hours first. "Over" is left for time that was
 * already there before the rule (imported or old entries), and it is still
 * flagged everywhere (the clock panel, Who's working, Rates & Costs,
 * Approvals). No allowance, no limit.
 *
 * Pure: the numbers come from the caller (lib/timeclock/allowance-limit.ts
 * reads them).
 */

import { QUARTER, formatDuration } from './rounding'
import { dateLabel, monthLong, monthYear, rangeLabel } from './format'
import { PAY_PERIOD_DAYS, addDays, anchorOn, cadenceOn, payPeriodStart, type AnchorChange, type Cadence, type CadenceChange } from './periods'

/**
 * The window an allowance counts in: a week, a calendar month, or a pay
 * period (14 days from the company's pay period start). 'pay_period' since
 * 9 November 2026 (owner, the hours limit covers the pay period).
 */
export type AllowancePeriod = 'week' | 'month' | 'pay_period'

/** What the number in Hours limit means (people.hours_limit_per, migration 163). */
export type HoursLimitPer = 'week' | 'month'

export interface AllowanceStatus {
  /** Seconds worked in the period. */
  used: number
  /** The allowance plus approved extra hours, in seconds. */
  limit: number
  /** Seconds past the limit (0 when under). */
  over: number
  /** Seconds left before the limit (0 when over). */
  left: number
  state: 'ok' | 'near' | 'over'
}

/**
 * A contractor's hours limit as typed (owner, 9 November 2026): the number in
 * the Work tab's Hours limit (people.weekly_hours) and what it is per
 * (people.hours_limit_per, 'week' or 'month'), with what the window is worked
 * out from: the person's cadence changes (tc_person_cadence; empty when none
 * was ever set) and the company's pay period starts (tc_pay_period_anchors).
 */
export interface Allowance {
  hours: number
  per: HoursLimitPer
  cadence: readonly CadenceChange[]
  anchors: readonly AnchorChange[]
}

/** One window of an allowance: its days and the hours it allows (before extra hours). */
export interface AllowanceWindow {
  period: AllowancePeriod
  from: string
  to: string
  hours: number
}

/**
 * The allowance, from Hours limit (owner, 5 November 2026; per week or per
 * month since 9 November 2026): only a contractor with a number above 0 has
 * one. A US employee has none (all are salaried), and neither does a
 * contractor with no number (no limit).
 */
export function allowanceFromLimit(
  isContractor: boolean, hours: number | null | undefined, per: string | null | undefined = 'week',
  cadence: readonly CadenceChange[] = [], anchors: readonly AnchorChange[] = [],
): Allowance | null {
  const h = hours == null ? NaN : Number(hours)
  if (!isContractor || !Number.isFinite(h) || h <= 0) return null
  return { hours: h, per: per === 'month' ? 'month' : 'week', cadence, anchors }
}

/**
 * The number as hours a week, for what reads it as weekly hours (Home's expected hours, the workload report):
 * hours a month x 12 / 52 (owner, 9 November 2026).
 */
export const weeklyEquivalent = (hours: number | null | undefined, per: string | null | undefined): number | null =>
  hours == null ? null : per === 'month' ? Math.round(((Number(hours) * 12) / 52) * 100) / 100 : Number(hours)

/** Monday to Friday between two days, both included (company holidays count as weekdays). */
export function weekdaysBetween(from: string, to: string): number {
  let n = 0
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const w = new Date(`${d}T00:00:00Z`).getUTCDay()
    if (w !== 0 && w !== 6) n++
  }
  return n
}

/**
 * How the person submits on a day, only when it was set for them
 * (tc_person_cadence): null when nobody set it, whatever the company default
 * (production had nobody set on 9 November 2026, and their limit stays a week).
 */
export function knownCadence(day: string, cadence: readonly CadenceChange[]): Cadence | null {
  const c = cadenceOn(day, { changes: cadence, fallback: 'monthly' })
  return c.from === null ? null : c.cadence
}

const round2 = (x: number) => Math.round(x * 100) / 100

/**
 * The window of the allowance a day falls in, and the hours it allows
 * (owner, 9 November 2026, "Hours Limit by Pay Period"): the limit covers the
 * person's pay period.
 *
 *   every 2 weeks, per week   the pay period (14 days from the company's pay
 *                             period start), 2 x the weekly number; with no
 *                             start set, the week and the weekly number
 *   monthly, per week         the calendar month, the weekly number / 5 x its
 *                             weekdays (Monday to Friday; holidays count):
 *                             30 h a week is 126 h in November 2026 (21)
 *   monthly, per month        the month, the number, every month
 *   every 2 weeks, per month  (Edit work does not offer it) the month, the number
 *   not set, per week         the week, the weekly number (as before)
 *   not set, per month        the month, the number
 */
export function allowanceFor(a: Pick<Allowance, 'hours' | 'per' | 'cadence' | 'anchors'>, day: string, weekStart = 0): AllowanceWindow {
  const c = knownCadence(day, a.cadence)
  if (a.per === 'month') return { period: 'month', ...allowanceRange(day, 'month'), hours: a.hours }
  if (c === 'monthly') {
    const r = allowanceRange(day, 'month')
    return { period: 'month', ...r, hours: round2((a.hours / 5) * weekdaysBetween(r.from, r.to)) }
  }
  if (c === 'biweekly') {
    const at = anchorOn(day, a.anchors)
    if (at) {
      const from = payPeriodStart(day, at.anchor)
      return { period: 'pay_period', from, to: addDays(from, PAY_PERIOD_DAYS - 1), hours: round2(a.hours * 2) }
    }
  }
  return { period: 'week', ...allowanceRange(day, 'week', weekStart), hours: a.hours }
}

/**
 * The hours the allowance allows in exactly these days, or null when they are
 * not one of its windows (a timesheet's month or pay period checked for
 * "over": only where the timesheet and the limit's window are the same days).
 */
export function hoursForPeriod(a: Pick<Allowance, 'hours' | 'per' | 'cadence' | 'anchors'>, start: string, end: string, weekStart = 0): number | null {
  const w = allowanceFor(a, start, weekStart)
  return w.from === start && w.to === end ? w.hours : null
}

/** "30 h / week", "120 h / month": the limit as typed. */
export const limitAsTyped = (a: Pick<Allowance, 'hours' | 'per'>): string => `${a.hours} h / ${a.per}`

/**
 * The limit with its window when that differs from what was typed (Rates &
 * Costs' Allowance): "30 h / week", "30 h / week · 126h 00m in Nov",
 * "30 h / week · 60h 00m a pay period", "120 h / month".
 */
export function limitSummary(a: Allowance, day: string, weekStart = 0): string {
  const w = allowanceFor(a, day, weekStart)
  const typed = limitAsTyped(a)
  if (a.per === 'month' || w.period === 'week') return typed
  if (w.period === 'pay_period') return `${typed} · ${formatDuration(w.hours * 3600)} a pay period`
  return `${typed} · ${formatDuration(w.hours * 3600)} in ${monthLong(w.from).slice(0, 3)}`
}

/**
 * The calculated lines under Hours limit in Edit work (mockup "Hours Limit by
 * Pay Period"), from what the form holds and how the person submits:
 *   "Limit each pay period: 60h 00m (2 weeks)"
 *   "November 2026: 21 weekdays → 126h 00m", and the two months after
 *   "Every month: 120h 00m, however many days it has"
 *   "Limit each week: 30h 00m"
 * Empty with no number.
 */
export function limitPreview(per: HoursLimitPer, hours: number | null, cadence: Cadence | null, anchors: readonly AnchorChange[], today: string): string[] {
  if (hours == null || !Number.isFinite(hours) || hours <= 0) return []
  const changes: CadenceChange[] = cadence ? [{ cadence, effectiveFrom: '0000-01-01' }] : []
  const a = { hours, per, cadence: changes, anchors }
  const w = allowanceFor(a, today)
  if (per === 'month') return [`Every month: ${formatDuration(hours * 3600)}, however many days it has`]
  if (w.period === 'pay_period') return [`Limit each pay period: ${formatDuration(w.hours * 3600)} (2 weeks)`]
  if (w.period === 'week') return [`Limit each week: ${formatDuration(hours * 3600)}`]
  const out: string[] = []
  for (let i = 0, d = w.from; i < 3; i++) {
    const m = allowanceFor(a, d)
    out.push(`${monthYear(m.from)}: ${weekdaysBetween(m.from, m.to)} weekdays → ${formatDuration(m.hours * 3600)}`)
    d = addDays(m.to, 1)
  }
  return out
}

/** At this share of the limit the line turns warn ("12h left this month"). */
export const NEAR_SHARE = 0.9

export function allowanceStatus(usedSeconds: number, allowanceHours: number, approvedExtraHours = 0): AllowanceStatus {
  const limit = Math.round((allowanceHours + approvedExtraHours) * 3600)
  const used = Math.max(0, Math.round(usedSeconds))
  const over = Math.max(0, used - limit)
  const state = over > 0 ? 'over' : used >= limit * NEAR_SHARE ? 'near' : 'ok'
  return { used, limit, over, left: Math.max(0, limit - used), state }
}

/** A week (from the company's week start) or a month around a day. allowanceFor decides which one a person's window is. */
export function allowanceRange(day: string, period: 'week' | 'month', weekStart = 0): { from: string; to: string } {
  const d = new Date(`${day}T00:00:00Z`)
  if (period === 'month') {
    const from = `${day.slice(0, 7)}-01`
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
    return { from, to: last.toISOString().slice(0, 10) }
  }
  const back = (d.getUTCDay() - weekStart + 7) % 7
  const start = new Date(d.getTime() - back * 86_400_000)
  const end = new Date(start.getTime() + 6 * 86_400_000)
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }
}

// ── The limit (owner, 25 October 2026) ──────────────────────────────────────

/** Time is logged on the quarter hour, so the room left before the limit is too. */
export const roomLeft = (leftSeconds: number): number => Math.max(0, Math.floor(leftSeconds / QUARTER) * QUARTER)

/** One entry counted in a window: its seconds as they stand (a running clock to now). Time off is never here. */
export interface CountedEntry { id: number; seconds: number }

/**
 * A change against the limit. `exclude` are the entries the change replaces
 * (an edited entry, the week grid's cells, a running clock), `adding` what
 * they become in this window. Refused when the window ends up past the limit
 * and with more than before: a change that keeps or lowers time already over
 * (imported or old entries) still goes through. `status` is the window without
 * the excluded entries, so its `left` is the room this change had.
 */
export function limitCheck(x: { counted: readonly CountedEntry[]; exclude?: readonly number[]; adding: number; hours: number; extraHours: number }): { status: AllowanceStatus; refused: boolean } {
  const out = new Set(x.exclude ?? [])
  const before = x.counted.reduce((s, e) => s + e.seconds, 0)
  const rest = x.counted.reduce((s, e) => s + (out.has(e.id) ? 0 : e.seconds), 0)
  const status = allowanceStatus(rest, x.hours, x.extraHours)
  const after = status.used + Math.max(0, Math.round(x.adding))
  return { status, refused: after > status.limit && after > before }
}

/**
 * Where a running clock meets the limit: its recorded start plus the room the
 * rest of the window left it, so the count never passes the limit. The real
 * instant is the same moment, never before the real clock in.
 */
export function limitStopPoint(recordedStart: string, roomBeforeSeconds: number, realStart: string | null = null): { real: string; recorded: string } {
  const recorded = new Date(Date.parse(recordedStart) + roomLeft(roomBeforeSeconds) * 1000).toISOString()
  const real = realStart && Date.parse(realStart) > Date.parse(recorded) ? realStart : recorded
  return { real, recorded }
}

/**
 * "October", "the week of Oct 18", or "the pay period Nov 8 to 21" (owner,
 * 9 November 2026), as the extra hours requests name a window. A pay period
 * with no last day given is the 14 days from `from`.
 */
export const windowName = (period: AllowancePeriod, from: string, to?: string): string =>
  period === 'month' ? monthLong(from)
    : period === 'pay_period' ? `the pay period ${rangeLabel(from, to ?? addDays(from, PAY_PERIOD_DAYS - 1))}`
      : `the week of ${dateLabel(from).replace(/, \d{4}$/, '')}`

/** "this week", "this month", "this pay period": the window around today. */
export const windowNow = (period: AllowancePeriod): string =>
  period === 'month' ? 'this month' : period === 'pay_period' ? 'this pay period' : 'this week'

/** "in October", "this week", "in the pay period Nov 8 to 21": where hours were counted. */
export const windowIn = (period: AllowancePeriod, from: string, to?: string): string =>
  period === 'week' ? 'this week' : `in ${windowName(period, from, to)}`

export interface LimitWords {
  period: AllowancePeriod
  /** The window's first day. */
  from: string
  /** The window's last day (names a pay period). */
  to?: string
  /** The allowance plus approved extra hours, in seconds. */
  limit: number
  /** The extra hours approved in the window (hours). */
  extraHours: number
  /** Seconds the change had before the limit. */
  left: number
  /** The person's name when someone else's hours are changed; null for one's own. */
  name?: string | null
}

/** "140h 00m allowance for October", and ", extra hours included" when some were approved. */
export const limitName = (w: Pick<LimitWords, 'limit' | 'period' | 'from' | 'to' | 'extraHours'>): string =>
  `${formatDuration(w.limit)} allowance for ${windowName(w.period, w.from, w.to)}${w.extraHours > 0 ? ', extra hours included' : ''}`

/**
 * The refusal, the same whoever adds the time (the limit is the person's):
 *   "You have used your 140h 00m allowance for October. Ask for extra hours to log more."
 *   "That goes past your 140h 00m allowance for October: 2h 15m left. Ask for extra hours to log more."
 * With `name`, the same about them.
 */
export function limitText(w: LimitWords): string {
  const room = roomLeft(w.left)
  if (room <= 0) {
    return w.name
      ? `${w.name} has used their ${limitName(w)}. Ask for extra hours to log more.`
      : `You have used your ${limitName(w)}. Ask for extra hours to log more.`
  }
  return `That goes past ${w.name ? `${w.name}'s` : 'your'} ${limitName(w)}: ${formatDuration(room)} left. Ask for extra hours to log more.`
}

/** The bell when a running clock reached the limit: "Your clock stopped at 4:15 PM: you have used your 140h 00m allowance for October. Ask for extra hours to log more." */
export const limitStoppedText = (when: string, w: Pick<LimitWords, 'limit' | 'period' | 'from' | 'to' | 'extraHours'>): string =>
  `Your clock stopped at ${when}: you have used your ${limitName(w)}. Ask for extra hours to log more.`

/** The panel's line before it happens: "Your clock stops by itself at 4:15 PM, at your allowance." */
export const limitAheadText = (at: string): string => `Your clock stops by itself at ${at}, at your allowance.`
