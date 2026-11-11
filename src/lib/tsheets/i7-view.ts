/**
 * The figures the i7 report shows in more than one place: the screen, the
 * printed PDFs, the Team Update image and the CSVs. Each of them used to work
 * these out on its own, and two had already drifted (audit, 9 October 2026):
 * the PDF said "On track" where the screen said "Watch", and the PDF's total
 * budgeted hours left out projects with no hours yet. One answer here, read
 * by all of them.
 *
 * Pure: no database, no React.
 */

import type { I7Carryover, I7Report } from './types'
import { shares } from './shares'
import { usHolidays } from '@/lib/notifications/calendar'

/** Moisture Meters (MME) is invoiced apart from the rest of i7. */
export const isMMEProject = (project: string): boolean => /mme|moisture/i.test(project)

export type BudgetStatus = 'good' | 'warn' | 'bad' | 'none'

/** Watch from three quarters of the money available this month, over past all of it. */
export function budgetStatus(used: number, available: number | null | undefined): BudgetStatus {
  if (available == null || available <= 0) return 'none'
  const share = used / available
  if (share > 1) return 'bad'
  if (share >= 0.75) return 'warn'
  return 'good'
}

export const BUDGET_STATUS_LABEL: Record<BudgetStatus, string> = {
  good: 'On track', warn: 'Watch', bad: 'Over budget', none: 'No budget',
}

// ── Pace (owner, 11 November 2026) ─────────────────────────────────────────
// TSheets showed the A.org budget against where it should be by this point of
// the month, so the team could tell whether it was behind or ahead. The i7
// budget now does too: the money available this month, spread over its working
// days (weekdays that are not company holidays), and today's share of it.

export type PaceStatus = 'onpace' | 'behind' | 'ahead' | 'bad' | 'none'

export const PACE_STATUS_LABEL: Record<PaceStatus, string> = {
  onpace: 'On pace', behind: 'Behind pace', ahead: 'Ahead of pace', bad: 'Over budget', none: 'No budget',
}

/** Within this share of today's pace, either way, it reads On pace. */
export const PACE_BAND = 0.1

/** Today in Washington DC, YYYY-MM-DD: the company's day. */
export const todayET = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)

const isoOf = (d: Date) => d.toISOString().slice(0, 10)

/** The working days of a month (YYYY-MM): weekdays that are not company holidays. */
export function workingDays(month: string): string[] {
  const [y, m] = month.split('-').map(Number)
  const holidays = usHolidays(y)
  const out: string[] = []
  for (let d = new Date(Date.UTC(y, m - 1, 1)); d.getUTCMonth() === m - 1; d = new Date(d.getTime() + 864e5)) {
    const w = d.getUTCDay(), iso = isoOf(d)
    if (w !== 0 && w !== 6 && !holidays.has(iso)) out.push(iso)
  }
  return out
}

export interface BudgetPace {
  status: PaceStatus
  /** Working days in the month, and those gone by today (today included). */
  days: number
  gone: number
  /** Share of the month's working days gone, 0 to 1. */
  share: number
  /** What should be used by today: the money available times that share. */
  expected: number
  /** Used minus expected: below zero is behind pace. */
  diff: number
  /** A day's worth to catch up over the working days left (0 when none are left or it is not behind). */
  perDayToCatchUp: number
}

/**
 * Where the month's spending stands against its pace. A past month counts all
 * its working days (the pace is the whole budget); a month not started yet,
 * none. Over the money available it is Over budget, whatever the pace.
 */
export function budgetPace(c: Pick<I7Carryover, 'monthUsed' | 'totalAvailable'>, month: string, today: string = todayET()): BudgetPace {
  const all = workingDays(month)
  const gone = all.filter(d => d <= today).length
  const share = all.length ? gone / all.length : 0
  const expected = c.totalAvailable > 0 ? c.totalAvailable * share : 0
  const diff = c.monthUsed - expected
  const left = all.length - gone
  const base = { days: all.length, gone, share, expected, diff, perDayToCatchUp: diff < 0 && left > 0 ? -diff / left : 0 }
  if (!(c.totalAvailable > 0)) return { ...base, status: 'none' }
  if (c.monthUsed > c.totalAvailable) return { ...base, status: 'bad' }
  // Before the first working day nothing is expected yet: anything used is ahead, nothing used is on pace.
  if (expected <= 0) return { ...base, status: c.monthUsed > 0 ? 'ahead' : 'onpace' }
  const r = c.monthUsed / expected
  return { ...base, status: r < 1 - PACE_BAND ? 'behind' : r > 1 + PACE_BAND ? 'ahead' : 'onpace' }
}

/** Share of the money available this month that was used, 0 to 1 and beyond. */
export function usedShare(c: I7Carryover | null | undefined): number {
  return c && c.totalAvailable > 0 ? c.monthUsed / c.totalAvailable : 0
}

/** Every project's budgeted hours, including the ones with no hours yet. */
export function totalBudgetHours(projectHours: Record<string, number>): number {
  return Object.values(projectHours).reduce((s, h) => s + h, 0)
}

/** Hours per person across the report. */
export function hoursByPerson(report: Pick<I7Report, 'projects'>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const p of report.projects) for (const [name, h] of Object.entries(p.byPerson)) out[name] = (out[name] ?? 0) + h
  return out
}

/** Hours per activity across the report, most first. */
export function activityMix(report: Pick<I7Report, 'projects'>): { activity: string; hours: number }[] {
  const m = new Map<string, number>()
  for (const p of report.projects) for (const jc of p.jobcodes) for (const a of jc.activities) m.set(a.activity, (m.get(a.activity) ?? 0) + a.hours)
  return [...m.entries()].map(([activity, hours]) => ({ activity, hours })).sort((a, b) => b.hours - a.hours)
}

/** Projects at or past a share of their budgeted hours (0.9: near budget). */
export function projectsNearBudget(report: Pick<I7Report, 'projects'>, projectHours: Record<string, number>, share = 0.9): string[] {
  return report.projects
    .filter(p => (projectHours[p.project] ?? 0) > 0 && p.hours / projectHours[p.project] >= share)
    .map(p => p.project.replace(/\s*\(.*\)/, ''))
}

/**
 * Who got what share of the money, at every level a client document lists it:
 * the two invoices, the projects under each, the job codes under each project.
 *
 * Shared out from the top down (audit, 13 October 2026): the invoices add up to
 * 100%, an invoice's projects to that invoice's share, a project's job codes to
 * that project's. Rounded on their own, the PDF's Share column could read 99%
 * or 101% under a total of 100%, and the client CSV the same. One answer here,
 * read by both, so the PDF and the spreadsheet of a month agree to the point.
 */
export interface I7CostShares {
  invoice: { i7: number; mme: number }
  project: Record<string, number>                    // project → % of the total
  jobcode: Record<string, Record<string, number>>    // project → job code → % of the total
}

export function costShares(report: Pick<I7Report, 'projects'>): I7CostShares {
  const cost = (ps: I7Report['projects']) => ps.reduce((s, p) => s + p.cost, 0)
  const i7 = report.projects.filter(p => !isMMEProject(p.project))
  const mme = report.projects.filter(p => isMMEProject(p.project))
  const [i7Share, mmeShare] = shares([cost(i7), cost(mme)])

  const project: Record<string, number> = {}
  const jobcode: Record<string, Record<string, number>> = {}
  for (const [group, total] of [[i7, i7Share], [mme, mmeShare]] as const) {
    const projectShares = shares(group.map(p => p.cost), { total })
    group.forEach((p, i) => {
      project[p.project] = projectShares[i]
      const codeShares = shares(p.jobcodes.map(j => j.cost), { total: projectShares[i] })
      jobcode[p.project] = Object.fromEntries(p.jobcodes.map((j, k) => [j.code, codeShares[k]]))
    })
  }
  return { invoice: { i7: i7Share, mme: mmeShare }, project, jobcode }
}
