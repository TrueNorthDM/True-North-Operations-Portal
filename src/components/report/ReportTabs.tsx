// The five tabs of the Report, as links, so each one is addressable.
//
// People and Workload each have a row on Admin, Access levels (since 18
// September 2026; before that they followed the directory level). A tab a
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
  { key: 'overview', label: 'Overview' },
  { key: 'people', label: 'People', gated: true },
  { key: 'workload', label: 'Workload', gated: true },
  { key: 'waits', label: 'Where it waits' },
  { key: 'method', label: 'Method' },
] as const

export type ReportTabKey = (typeof REPORT_TABS)[number]['key']

/** The two tabs that are switched per level on Admin, Access levels. */
export type TabRights = { people: boolean; workload: boolean }

export function tabRights(can: (surfaceKey: string) => boolean): TabRights {
  return { people: can(REPORT_PEOPLE), workload: can(REPORT_WORKLOAD) }
}

/**
 * What the directory levels gave before the tabs had rows of their own: People
 * from level 2, Workload at level 3. Only the design check still draws levels.
 */
export function rightsForLevel(level: number): TabRights {
  return { people: level >= 2, workload: level >= 3 }
}

export function visibleTabs(rights: TabRights) {
  return REPORT_TABS.filter(t => !('gated' in t) || rights[t.key as keyof TabRights])
}

/**
 * Screen 6.6: the tab this level actually gets.
 *
 * A link shared by an admin, or a bookmark kept after a role change, has to
 * degrade quietly. Resolving here and redirecting on the server follows the
 * portal's existing pattern and beats rendering a tab that then throws.
 */
export function resolveTab(asked: string | undefined, rights: TabRights): ReportTabKey {
  const allowed = visibleTabs(rights).map(t => t.key as string)
  return allowed.includes(asked ?? '') ? (asked as ReportTabKey) : 'overview'
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
