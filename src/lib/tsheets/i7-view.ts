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
