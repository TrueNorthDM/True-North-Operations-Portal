// The Report's five tabs and who sees which. Pure, so the page, the print
// page, the files (lib/report/view.ts) and the tab bar share one answer.

import { REPORT_PEOPLE, REPORT_WORKLOAD } from '@/lib/access/surfaces'

export const REPORT_TABS = [
  { key: 'overview', label: 'Overview', item: 'rp-overview' },
  { key: 'people', label: 'People', item: REPORT_PEOPLE },
  { key: 'workload', label: 'Workload', item: REPORT_WORKLOAD },
  { key: 'waits', label: 'Where it waits', item: 'rp-waits' },
  { key: 'method', label: 'Method', item: 'rp-method' },
] as const

export type ReportTabKey = (typeof REPORT_TABS)[number]['key']

/** Each tab's tick on Admin, Access levels. */
export type TabRights = Record<ReportTabKey, boolean>

export function tabRights(can: (surfaceKey: string) => boolean): TabRights {
  return Object.fromEntries(REPORT_TABS.map(t => [t.key, can(t.item)])) as TabRights
}

/**
 * What the directory levels gave before the tabs had rows of their own: People
 * from level 2, Workload at level 3. Only the design check still draws levels.
 */
export function rightsForLevel(level: number): TabRights {
  return { overview: true, people: level >= 2, workload: level >= 3, waits: true, method: true }
}

export function visibleTabs(rights: TabRights) {
  return REPORT_TABS.filter(t => rights[t.key])
}

/**
 * Screen 6.6: the tab this level actually gets.
 *
 * A link shared by an admin, or a bookmark kept after a role change, has to
 * degrade quietly. Resolving here and redirecting on the server follows the
 * portal's existing pattern and beats rendering a tab that then throws.
 */
export function resolveTab(asked: string | undefined, rights: TabRights): ReportTabKey | null {
  const allowed = visibleTabs(rights).map(t => t.key as string)
  // The tab asked for, else the first one open; null when none is.
  return allowed.includes(asked ?? '') ? (asked as ReportTabKey) : (allowed[0] as ReportTabKey | undefined) ?? null
}
