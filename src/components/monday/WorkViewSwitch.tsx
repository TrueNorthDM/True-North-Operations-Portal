// My Work · Report · My Team, the one control that moves between the three.
//
// It lives here rather than in each page because it is on all three of them
// and the pages are the only thing that differs. Copying it would have meant
// the next change to the control landing wherever I happened to remember,
// which is how the team lookup ended up wrong in two places at once.
//
// Report sits in the middle on purpose: it is about both of the others.

import Link from 'next/link'

export type WorkView = 'work' | 'report' | 'team'

function BriefcaseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3v18h18" />
      <path d="M7 15l4-5 3 3 4-6" />
    </svg>
  )
}

function TeamIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

const VIEWS: { key: WorkView; label: string; href: string; Icon: () => React.ReactElement }[] = [
  { key: 'work', label: 'My Work', href: '/my-work', Icon: BriefcaseIcon },
  { key: 'report', label: 'Report', href: '/report', Icon: ChartIcon },
  { key: 'team', label: 'My Team', href: '/my-work?tab=team', Icon: TeamIcon },
]

export function WorkViewSwitch({ active }: { active: WorkView }) {
  return (
    <div className="flex items-center bg-subtle border border-[var(--panel-border)] rounded-[11px] p-1">
      {VIEWS.map(v => (
        <Link
          key={v.key}
          href={v.href}
          aria-current={v.key === active ? 'page' : undefined}
          className={`inline-flex items-center gap-[7px] px-[15px] py-2 rounded-[8px] font-(family-name:--font-display) font-extrabold text-[13.5px] transition-colors ${
            v.key === active
              ? 'bg-white text-tn-ink shadow-[0_1px_3px_rgba(1,35,88,.14)]'
              : 'text-muted hover:text-tn-ink'
          }`}
        >
          <v.Icon />
          {v.label}
        </Link>
      ))}
    </div>
  )
}
