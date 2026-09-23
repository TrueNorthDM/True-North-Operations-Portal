/**
 * The rows and totals the People tab and the by-person exports show: the four
 * projects without i7 and MME, which stay off it for now (September 2026).
 *
 * Pure, and in a file of its own: the report on screen is a client component,
 * and projects.ts reads the database.
 */

import type { ProjectRow, ProjectTracking } from './projects'

const round2 = (n: number) => Math.round(n * 100) / 100

export function peopleView(data: Pick<ProjectTracking, 'rows'>): {
  rows: ProjectRow[]; workedThisMonth: number; yearToDate: number; sameMonthLastYear: number
} {
  const rows = data.rows.filter(r => !r.billed)
  return {
    rows,
    workedThisMonth: round2(rows.reduce((s, r) => s + r.workedThisMonth, 0)),
    yearToDate: round2(rows.reduce((s, r) => s + r.yearToDate, 0)),
    sameMonthLastYear: round2(rows.reduce((s, r) => s + r.sameMonthLastYear, 0)),
  }
}
