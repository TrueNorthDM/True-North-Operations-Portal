/**
 * The hours allowance (Clocky part 2, README_PART2 "Allowance & extra hours"):
 * the hours a person is expected to work in a week or a month. Going over is
 * never blocked; it is flagged everywhere (the clock panel, Who's working,
 * Rates & Costs, Approvals) unless extra hours were approved before.
 *
 *   ok     under 90% of the allowance (plus approved extra hours)
 *   near   90% or more ("12h left this month")
 *   over   past it ("3h over your allowance, not approved")
 *
 * Pure: the numbers come from the caller.
 */

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
