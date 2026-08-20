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

export const REPORT_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'people', label: 'People' },
  { key: 'workload', label: 'Workload', minLevel: 3 },
  { key: 'waits', label: 'Where it waits' },
  { key: 'method', label: 'Method' },
] as const

export type ReportTabKey = (typeof REPORT_TABS)[number]['key']

export function visibleTabs(level: number) {
  return REPORT_TABS.filter(t => !('minLevel' in t) || level >= t.minLevel)
}

export function ReportTabs(
  { active, level, params, ready, base = '/report' }:
  {
    active: ReportTabKey; level: number; params?: Record<string, string>
    ready?: readonly ReportTabKey[]; base?: string
  },
) {
  const query = (tab: string) => {
    const q = new URLSearchParams(params ?? {})
    if (tab === 'overview') q.delete('tab')
    else q.set('tab', tab)
    const s = q.toString()
    return s ? `${base}?${s}` : base
  }

  return (
    <div className="flex items-center gap-0.5 border-b border-[var(--panel-border)] mb-5">
      {visibleTabs(level).filter(t => !ready || ready.includes(t.key)).map(t => (
        <Link
          key={t.key}
          href={query(t.key)}
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
