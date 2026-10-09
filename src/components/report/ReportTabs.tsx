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
import { visibleTabs, type ReportTabKey, type TabRights } from '@/lib/report/tabs'

export { REPORT_TABS, resolveTab, rightsForLevel, tabRights, visibleTabs } from '@/lib/report/tabs'
export type { ReportTabKey, TabRights } from '@/lib/report/tabs'


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
