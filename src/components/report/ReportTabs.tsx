// The five tabs of the Report, as links, so each one is addressable.
//
// Every tab has a row on Admin, Access levels (People and Workload since 18
// September 2026, the other three since 7 October 2026). A tab a
// person may not see is not shown at all rather than disabled: a person who
// cannot see it has no reason to know it is there, and a greyed tab only
// invites the question.
//
// `ready` is the same idea applied to tabs that are not built yet. A tab that
// is shown and does nothing is worse than one that is not shown: it is a
// promise the page cannot keep, and the person clicking it has no way to tell
// the difference between unfinished and broken.

import Link from 'next/link'
import { reportHref, type ReportState } from '@/lib/report/scope'
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

export function ReportTabs(
  { active, rights, state, ready, base = '/report' }:
  {
    active: ReportTabKey; rights: TabRights
    /** The rest of the URL state, carried through every tab link. */
    state: ReportState
    ready?: readonly ReportTabKey[]; base?: string
  },
) {

  return (
    <div className="flex items-center gap-0.5 border-b border-[var(--panel-border)] mb-5">
      {visibleTabs(rights).filter(t => !ready || ready.includes(t.key)).map(t => (
        <Link
          key={t.key}
          href={reportHref(base, state, { tab: t.key })}
          aria-current={t.key === active ? 'page' : undefined}
          className={`px-4 py-2.5 text-[13.5px] font-semibold -mb-px border-b-2 transition-colors ${
            t.key === active
              ? 'text-tn-ink border-tn-teal'
              : 'text-muted border-transparent hover:text-tn-ink'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  )
}
