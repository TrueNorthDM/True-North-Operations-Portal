/**
 * The annual review's calendar (owner, 10 November 2026;
 * docs/annual-review/01-workflow-2026-11.md). Pure, so it can be tested.
 *
 * Every due date comes from the kickoff day. With the kickoff on the second
 * Monday of November, everything is approved by mid-December:
 *
 *   K+2   the CISO's Company Priorities        K+25  leaders: meeting, read and agreed
 *   K+4   the VP of Operations' priorities     K+30  teams: meeting, read and agreed
 *   K+11  everyone's self-review               K+32  leaders: approval
 *   K+16  reviews written, meetings booked     K+36  teams: approval
 *
 * A date that lands on a weekend moves to the Monday after. The 6-month
 * check-in comes six calendar months after the kickoff.
 *
 * The dates rule: a later date may move earlier when the step before it
 * finished early (moveUp); a late step never pushes the dates after it.
 */

import { addDays, dayDiff } from './rules'

export type DateKey = 'company_due' | 'vp_due' | 'self_due' | 'review_due' | 'leaders_meeting_due' | 'meeting_due' | 'leaders_approval_due' | 'approval_due'

/** The steps with a due date, in the order they come. */
export const PLAN: readonly { key: DateKey; days: number; label: string }[] = [
  { key: 'company_due', days: 2, label: 'Company Priorities' },
  { key: 'vp_due', days: 4, label: "VP of Operations' priorities" },
  { key: 'self_due', days: 11, label: 'Self-review' },
  { key: 'review_due', days: 16, label: 'Review written and meeting booked' },
  { key: 'leaders_meeting_due', days: 25, label: 'Leaders: meeting, read and agreed' },
  { key: 'meeting_due', days: 30, label: 'Teams: meeting, read and agreed' },
  { key: 'leaders_approval_due', days: 32, label: 'Leaders: approval' },
  { key: 'approval_due', days: 36, label: 'Teams: approval' },
]

export type Plan = Record<DateKey, string>

/** The weekday of a YYYY-MM-DD day, 0 Sunday to 6 Saturday. */
export const weekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay()

/** A weekend day moves to the Monday after. */
export function workday(day: string): string {
  const w = weekday(day)
  return w === 6 ? addDays(day, 2) : w === 0 ? addDays(day, 1) : day
}

/** Every due date from the kickoff day. */
export function planFrom(kickoff: string): Plan {
  return Object.fromEntries(PLAN.map(p => [p.key, workday(addDays(kickoff, p.days))])) as Plan
}

/** Six calendar months after the kickoff (the last day of a shorter month), on a weekday. */
export function sixMonthsAfter(kickoff: string): string {
  const [y, m, d] = kickoff.split('-').map(Number)
  const ty = m + 6 > 12 ? y + 1 : y
  const tm = ((m + 6 - 1) % 12) + 1
  const last = new Date(Date.UTC(ty, tm, 0)).getUTCDate()
  return workday(`${ty}-${String(tm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`)
}

/** The second Monday of November: the day the VP of Operations is asked to start the year's reviews. */
export function kickoffReminderDay(year: number): string {
  const first = new Date(Date.UTC(year, 10, 1)).getUTCDay()
  const firstMonday = 1 + ((8 - first) % 7)
  return `${year}-11-${String(firstMonday + 7).padStart(2, '0')}`
}

/** The VP's "Start the reviews" row: from the second Monday of November until the year is started. */
export function kickoffRowShows(today: string, year: number, started: boolean): boolean {
  return !started && today >= kickoffReminderDay(year) && today.slice(0, 4) === String(year)
}

/**
 * The dates rule. When the step ending on `key` is done before its date, the
 * steps after it may come earlier by the days saved (counted from today, so a
 * date never moves into the past). Returns the dates to change, or null when
 * nothing would move.
 */
export function moveUp(dates: Partial<Record<DateKey, string | null>>, key: DateKey, today: string): { days: number; patch: Partial<Record<DateKey, string>> } | null {
  const due = dates[key]
  if (!due) return null
  const days = dayDiff(today, due)
  if (days <= 0) return null
  const after = PLAN.slice(PLAN.findIndex(p => p.key === key) + 1)
  const patch: Partial<Record<DateKey, string>> = {}
  for (const p of after) {
    const d = dates[p.key]
    if (d) patch[p.key] = workday(addDays(d, -days))
  }
  return Object.keys(patch).length ? { days, patch } : null
}

/** The dates out of order, as sentences: "Review by (Nov 20) is before Self-review (Nov 25)." */
export function orderProblems(dates: Partial<Record<DateKey, string | null>>, fmt: (d: string) => string): string[] {
  const out: string[] = []
  // The two lanes run side by side: each date is checked against the last one it must follow.
  const follows: Partial<Record<DateKey, DateKey>> = {
    vp_due: 'company_due', self_due: 'vp_due', review_due: 'self_due',
    leaders_meeting_due: 'review_due', meeting_due: 'review_due',
    leaders_approval_due: 'leaders_meeting_due', approval_due: 'meeting_due',
  }
  const label = (k: DateKey) => PLAN.find(p => p.key === k)!.label
  for (const [k, before] of Object.entries(follows) as [DateKey, DateKey][]) {
    const a = dates[before], b = dates[k]
    if (a && b && b < a) out.push(`${label(k)} (${fmt(b)}) is before ${label(before)} (${fmt(a)}). Move one of them.`)
  }
  return out
}

/** The check-in's dates from the day it starts: priorities checked, meetings booked, the check-in done. */
export function checkinPlanFrom(start: string): { ck_priorities_due: string; ck_book_due: string; ck_done_due: string } {
  return { ck_priorities_due: workday(addDays(start, 4)), ck_book_due: workday(addDays(start, 11)), ck_done_due: workday(addDays(start, 25)) }
}

/**
 * The goals for next year open when the CISO and the VP of Operations marked
 * their priorities ready, or the VP's date has passed. A year from before the
 * workflow (no VP date) keeps them open.
 */
export function goalsOpen(c: { vp_due?: string | null; company_done_at?: string | null; vp_done_at?: string | null }, today: string): boolean {
  if (!c.vp_due) return true
  return (!!c.company_done_at && !!c.vp_done_at) || today > c.vp_due
}
