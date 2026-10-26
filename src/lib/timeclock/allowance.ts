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
import { dateLabel, monthLong } from './format'

export type AllowancePeriod = 'week' | 'month'

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

/** At this share of the limit the line turns warn ("12h left this month"). */
export const NEAR_SHARE = 0.9

export function allowanceStatus(usedSeconds: number, allowanceHours: number, approvedExtraHours = 0): AllowanceStatus {
  const limit = Math.round((allowanceHours + approvedExtraHours) * 3600)
  const used = Math.max(0, Math.round(usedSeconds))
  const over = Math.max(0, used - limit)
  const state = over > 0 ? 'over' : used >= limit * NEAR_SHARE ? 'near' : 'ok'
  return { used, limit, over, left: Math.max(0, limit - used), state }
}

/** The days the allowance counts in: the week (from the company's week start) or the month, around a day. */
export function allowanceRange(day: string, period: AllowancePeriod, weekStart = 0): { from: string; to: string } {
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

/** "October", or "the week of Oct 18", as the extra hours requests name a week. */
export const windowName = (period: AllowancePeriod, from: string): string =>
  period === 'month' ? monthLong(from) : `the week of ${dateLabel(from).replace(/, \d{4}$/, '')}`

export interface LimitWords {
  period: AllowancePeriod
  /** The window's first day. */
  from: string
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
export const limitName = (w: Pick<LimitWords, 'limit' | 'period' | 'from' | 'extraHours'>): string =>
  `${formatDuration(w.limit)} allowance for ${windowName(w.period, w.from)}${w.extraHours > 0 ? ', extra hours included' : ''}`

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
export const limitStoppedText = (when: string, w: Pick<LimitWords, 'limit' | 'period' | 'from' | 'extraHours'>): string =>
  `Your clock stopped at ${when}: you have used your ${limitName(w)}. Ask for extra hours to log more.`

/** The panel's line before it happens: "Your clock stops by itself at 4:15 PM, at your allowance." */
export const limitAheadText = (at: string): string => `Your clock stops by itself at ${at}, at your allowance.`
