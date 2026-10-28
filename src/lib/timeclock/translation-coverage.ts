/**
 * Does the translation table (structure-2026.ts) still cover what people pick
 * in TSheets? It compares every value in use since the start of 2026 with the
 * table and lists what has no line yet, so a new job, field value or i7 code is
 * found early instead of on the switch date.
 *
 * Pure: the loader (translation-coverage-data.ts) reads the portal's own copy
 * of QuickBooks Time and hands the counts here.
 */

import { OLD_ACTIVITIES, OLD_COMPANIES, OLD_JOBS, OLD_PROJECTS, OLD_TASKS, i7DivisionOf, type Sureness, type Translation } from './structure-2026'

export type CoverageField = 'Job' | '1 Company' | '2 Project' | '3 Activity' | 'Tasks' | '1 - i7 Code'

export interface Used { field: CoverageField; value: string; hours: number; entries: number; lastDay: string }

export interface CoverageLine extends Used {
  /** 'missing' = no line in the table; otherwise how sure the table's line is. */
  status: 'missing' | Sureness
}

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
const TABLES: Record<Exclude<CoverageField, '1 - i7 Code'>, Translation[]> = {
  'Job': OLD_JOBS, '1 Company': OLD_COMPANIES, '2 Project': OLD_PROJECTS, '3 Activity': OLD_ACTIVITIES, 'Tasks': OLD_TASKS,
}

/** Top-level job names the table knows; a child job (Content under 1 - True North) is covered by its top. */
const NOT_A_VALUE = new Set(['', '1 none'])

export function lineFor(u: Used): CoverageLine {
  if (NOT_A_VALUE.has(norm(u.value))) return { ...u, status: 'same' }
  if (u.field === '1 - i7 Code') return { ...u, status: i7DivisionOf(u.value) ? 'same' : 'missing' }
  const t = TABLES[u.field].find(x => norm(x.old) === norm(u.value))
  return { ...u, status: t ? t.sure : 'missing' }
}

/** What to do about the table, most urgent first: missing, then the ones still to confirm. */
export function coverage(used: readonly Used[]): { missing: CoverageLine[]; toConfirm: CoverageLine[]; covered: number } {
  const lines = used.filter(u => u.hours > 0 || u.entries > 0).map(lineFor)
  const byHours = (a: CoverageLine, b: CoverageLine) => b.hours - a.hours
  return {
    missing: lines.filter(l => l.status === 'missing').sort(byHours),
    toConfirm: lines.filter(l => l.status === 'check').sort(byHours),
    covered: lines.filter(l => l.status !== 'missing' && l.status !== 'check').length,
  }
}

/** The report as plain text, like the TSheets inventory page. */
export function coverageText(r: ReturnType<typeof coverage>, since: string): string {
  const row = (l: CoverageLine) => `  ${l.field.padEnd(12)} ${l.value.padEnd(40)} ${l.hours.toFixed(0).padStart(6)} h  ${String(l.entries).padStart(5)} entries  last ${l.lastDay}`
  return [
    `Translation table coverage, entries since ${since}`,
    `Covered: ${r.covered}. Missing: ${r.missing.length}. To confirm: ${r.toConfirm.length}.`,
    '',
    r.missing.length ? 'MISSING (no line in the translation table yet):' : 'Nothing is missing: every value in use has a line.',
    ...r.missing.map(row),
    '',
    r.toConfirm.length ? 'TO CONFIRM (Tina, David or Rock):' : 'Nothing is waiting for confirmation.',
    ...r.toConfirm.map(row),
    '',
  ].join('\n')
}
