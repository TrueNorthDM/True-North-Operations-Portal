'use client'

// Screens 3.1 and 3.2: the team and person filters on the Workload tab.
//
// A client component because the portal's Select is one, and because these
// two write to the URL rather than to state: everything else on the Report
// reads the query string, so a filter that lived in React state would be the
// one control a pasted link could not carry.

import { useRouter, useSearchParams } from 'next/navigation'
import { Select } from '@/components/ui/Select'

export function WorkloadFilters({
  teams, people, note,
}: {
  teams: { id: string; name: string }[]
  people: { id: string; name: string }[]
  /** What the selection amounts to, e.g. "2 people on Writing, member by member". */
  note: string
}) {
  const router = useRouter()
  const params = useSearchParams()

  const team = params.get('team') ?? ''
  const person = params.get('person') ?? ''

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    // Picking a filter forces the scope to Everyone, so drop whatever scope
    // was there rather than leaving a value the page is no longer obeying.
    if (value) next.delete('scope')
    const q = next.toString()
    router.push(q ? `/report?${q}` : '/report')
  }

  const clear = () => {
    const next = new URLSearchParams(params.toString())
    next.delete('team')
    next.delete('person')
    const q = next.toString()
    router.push(q ? `/report?${q}` : '/report')
  }

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
        options={[{ value: '', label: 'Anyone' }, ...people.map(p => ({ value: p.id, label: p.name }))]}
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
