'use client'

/**
 * AccessLogManager: the Access log tab. A searchable, filterable, sortable list
 * of portal accesses (who, when, from which device). Read-only; admin-only (the
 * whole DirectoryTabs surface is already gated to privileged tiers).
 */

import { useMemo, useState } from 'react'
import { TEAM_COLOR, type TeamKey } from '@/lib/directory/people-types'
import { Avatar } from '@/components/Avatar'
import { deviceLabel } from '@/lib/user-agent'
import { FilterBar } from './grid/FilterBar'
import { SortHeader } from './grid/SortHeader'
import { applyFilters, applySort, nextSort } from './grid/utils'
import type { FilterCond, GridColumn, SortState } from './grid/types'

export interface AccessLogEntry {
  id: string
  personId: string | null
  name: string
  email: string
  userAgent: string | null
  accessedAt: string // ISO timestamp
  avatarUrl: string | null
  teamKey: TeamKey
}

function fmtWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function AccessLogManager({ entries }: { entries: AccessLogEntry[] }) {
  const [q, setQ] = useState('')
  const [conds, setConds] = useState<FilterCond[]>([])
  const [sort, setSort] = useState<SortState | null>({ id: 'when', dir: 'desc' })

  const filterColumns = useMemo<GridColumn<AccessLogEntry>[]>(() => [
    { id: 'name', label: 'Person', type: 'text', get: e => e.name },
    { id: 'email', label: 'Email', type: 'text', get: e => e.email },
    { id: 'when', label: 'When', type: 'date', get: e => e.accessedAt },
    { id: 'device', label: 'Device', type: 'text', get: e => deviceLabel(e.userAgent) },
  ], [])

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    const base = term
      ? entries.filter(e => `${e.name} ${e.email} ${deviceLabel(e.userAgent)}`.toLowerCase().includes(term))
      : entries
    return applySort(applyFilters(base, filterColumns, conds), filterColumns, sort)
  }, [entries, q, conds, sort, filterColumns])

  const gridTemplate = '2fr 1.6fr 1.2fr 1fr'

  return (
    <div>
      <div className="flex items-center gap-3.5 flex-wrap mb-[18px]">
        <div className="relative flex-1 min-w-[230px] max-w-[340px]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="absolute left-[13px] top-1/2 -translate-y-1/2 text-muted"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Search accesses…" className="w-full text-sm text-tn-ink bg-white border border-slate-200 rounded-[11px] pl-[38px] pr-3.5 py-[11px] focus:outline-none focus:border-tn-teal" />
        </div>
        <FilterBar columns={filterColumns} conds={conds} onChange={setConds} />
        <span className="ml-auto text-[12.5px] text-muted">{rows.length} of {entries.length} accesses</span>
      </div>

      <div className="border border-slate-200 bg-white rounded-[16px] overflow-hidden shadow-[0_1px_2px_rgba(1,35,88,.06)]">
        <div className="grid gap-3.5 items-center px-[22px] py-[13px] bg-subtle border-b border-slate-200" style={{ gridTemplateColumns: gridTemplate }}>
          <SortHeader label="Person" active={sort?.id === 'name'} dir={sort?.id === 'name' ? sort.dir : null} onClick={() => setSort(s => nextSort(s, 'name'))} />
          <SortHeader label="Email" active={sort?.id === 'email'} dir={sort?.id === 'email' ? sort.dir : null} onClick={() => setSort(s => nextSort(s, 'email'))} />
          <SortHeader label="When" active={sort?.id === 'when'} dir={sort?.id === 'when' ? sort.dir : null} onClick={() => setSort(s => nextSort(s, 'when'))} />
          <SortHeader label="Device" active={sort?.id === 'device'} dir={sort?.id === 'device' ? sort.dir : null} onClick={() => setSort(s => nextSort(s, 'device'))} />
        </div>

        {rows.map((e, i) => (
          <div key={e.id} className={`grid gap-3.5 items-center px-[22px] py-[11px] ${i === 0 ? '' : 'border-t border-slate-200'}`} style={{ gridTemplateColumns: gridTemplate }}>
            <span className="inline-flex items-center gap-3 min-w-0">
              <Avatar name={e.name} avatarUrl={e.avatarUrl} size={32} color={TEAM_COLOR[e.teamKey]} />
              <span className="font-(family-name:--font-display) font-bold text-[13.5px] text-tn-ink truncate">{e.name}</span>
            </span>
            <span className="text-[13px] text-muted truncate">{e.email || '-'}</span>
            <span className="text-[13px] text-foreground whitespace-nowrap tabular-nums">{fmtWhen(e.accessedAt)}</span>
            <span className="text-[13px] text-foreground truncate">{deviceLabel(e.userAgent)}</span>
          </div>
        ))}

        {rows.length === 0 && (
          <div className="px-[22px] py-[52px] text-center">
            <p className="text-sm text-muted">{entries.length === 0 ? 'No accesses recorded yet.' : 'No accesses match this filter.'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
