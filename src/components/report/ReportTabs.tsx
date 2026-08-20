// The five tabs of the Report, as links, so each one is addressable.
//
// Workload is level 3 only. It is not hidden behind a disabled tab: a person
// who cannot see it has no reason to know it is there, and a greyed tab only
// invites the question.
//
// `ready` is the same idea applied to tabs that are not built yet. A tab that
// is shown and does nothing is worse than one that is not shown: it is a
// promise the page cannot keep, and the person clicking it has no way to tell
// the difference between unfinished and broken.

import Link from 'next/link'
import { reportHref, type ReportState } from '@/lib/report/scope'

export const REPORT_TABS = [
  { key: 'overview', label: 'Overview' },
  // Level 2 and up. Control 2.1 says level 1 "never sees another name", and
  // this tab is nothing but other people's names. With Workload that makes
  // the two tabs fewer that screen 2.5 counts.
  { key: 'people', label: 'People', minLevel: 2 },
  { key: 'workload', label: 'Workload', minLevel: 3 },
  { key: 'waits', label: 'Where it waits' },
  { key: 'method', label: 'Method' },
] as const

export type ReportTabKey = (typeof REPORT_TABS)[number]['key']

export function visibleTabs(level: number) {
  return REPORT_TABS.filter(t => !('minLevel' in t) || level >= t.minLevel)
}

export function ReportTabs(
  { active, level, state, ready, base = '/report' }:
  {
    active: ReportTabKey; level: number
    /** The rest of the URL state, carried through every tab link. */
    state: ReportState
    ready?: readonly ReportTabKey[]; base?: string
  },
) {

  return (
    <div className="flex items-center gap-0.5 border-b border-[var(--panel-border)] mb-5">
      {visibleTabs(level).filter(t => !ready || ready.includes(t.key)).map(t => (
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
