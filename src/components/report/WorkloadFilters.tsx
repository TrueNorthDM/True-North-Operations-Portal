'use client'

// Screens 3.1 and 3.2: the team and person filters on the Workload tab.
//
// A client component because the portal's Select is one, and because these
// two write to the URL rather than to state: everything else on the Report
// reads the query string, so a filter that lived in React state would be the
// one control a pasted link could not carry.

import { useRouter, useSearchParams } from 'next/navigation'
import { withViewAs } from '@/components/ViewAsKeeper'
import { Select } from '@/components/ui/Select'
import { applyFilter, clearFilters, toQuery, type FilterKey } from '@/lib/report/filters'

export function WorkloadFilters({
  teams, people, note,
}: {
  /** From team_members, and only teams with an active member on them. */
  teams: { id: string; name: string }[]
  /** Every person in scope, each tagged with the teams they are on. */
  people: { id: string; name: string; teamIds: string[] }[]
  /** What the selection amounts to, e.g. "2 people on Writing, member by member". */
  note: string
}) {
  const router = useRouter()
  const params = useSearchParams()

  const team = params.get('team') ?? ''
  const person = params.get('person') ?? ''

  const current = Object.fromEntries(params.entries())
  const go = (next: Record<string, string>) => {
    const q = toQuery(next)
    router.push(withViewAs(q ? `/report?${q}` : '/report'))
  }

  const setParam = (key: FilterKey, value: string) => go(applyFilter(current, key, value))
  const clear = () => go(clearFilters(current))

  // Screen 4.2: with a team picked, the person list holds only its members.
  // Offering the rest would offer combinations that return nothing.
  const inScope = team ? people.filter(p => p.teamIds.includes(team)) : people

  const active = 'border-tn-teal bg-[rgba(30,125,127,.07)]'
  const idle = 'border-[var(--panel-border)] bg-white'

  return (
    <div className="flex items-center gap-2.5 flex-wrap mb-4">
      <Select
        value={team}
        onChange={v => setParam('team', v)}
        options={[{ value: '', label: 'All teams' }, ...teams.map(t => ({ value: t.id, label: t.name }))]}
        ariaLabel="Team"
        className={`rounded-[10px] border text-[13.5px] font-semibold text-tn-ink ${team ? active : idle}`}
      />

      <Select
        value={person}
        onChange={v => setParam('person', v)}
        options={[{ value: '', label: 'Anyone' }, ...inScope.map(p => ({ value: p.id, label: p.name }))]}
        ariaLabel="Person"
        searchable
        className={`rounded-[10px] border text-[13.5px] font-semibold text-tn-ink ${person ? active : idle}`}
      />

      {/* Only offered when there is something to clear. A permanently visible
          Clear invites a click that does nothing. */}
      {team || person ? (
        <button
          type="button"
          onClick={clear}
          className="text-[13px] font-semibold px-3 py-[9px] rounded-[10px] border border-[var(--panel-border)] text-muted hover:text-tn-ink transition-colors"
        >
          Clear
        </button>
      ) : null}

      <span className="text-[12.5px] text-muted">{note}</span>
    </div>
  )
}
