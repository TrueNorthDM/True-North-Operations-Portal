'use client'

/**
 * PeopleManager: the People tab of the Directory. A searchable, filterable,
 * column-configurable roster grouped into Active / Inactive. Rows open the
 * shared person modal (owned by DirectoryTabs).
 */

import { useEffect, useMemo, useState } from 'react'
import {
  TEAM_COLOR,
  PILL_CLASS,
  initialsOf,
  formatDate,
  typePill,
  timePill,
  roleTypePill,
  ROLE_TYPE_OPTIONS,
  ROLE_TYPE_LABEL,
  type PersonView,
  type Pill,
} from './people-types'
import { Avatar } from '@/components/Avatar'
import type { TeamOption } from './DirectoryTabs'
import { FilterBar } from './grid/FilterBar'
import { SortHeader } from './grid/SortHeader'
import { applyFilters, applySort, nextSort } from './grid/utils'
import type { FilterCond, GridColumn, SortState } from './grid/types'

type ColId = 'team' | 'role' | 'job' | 'reports' | 'type' | 'time' | 'joined' | 'rate' | 'status' | 'tsheets'

// Ordered to match the contact card (components/admin/RestrictedDirectory →
// ProfileCard, the same layout as My profile), so scanning a row and reading a
// card follow the same sequence:
//   header      job title, team, contact type, status
//   Employment  type, schedule
//   Reporting   reports to
//   Dates       joined
// Internal rate and TSheets close the row: neither appears on the card (the
// rate is deliberately kept off it), so they have no place in that sequence.
//
// The visible set is filtered THROUGH this array, so changing the order here
// reorders every table, including column choices already saved in localStorage.
const COLUMNS: { id: ColId; label: string; fr: string; align?: 'right' }[] = [
  { id: 'job', label: 'Job title', fr: '1.2fr' },
  { id: 'team', label: 'Team', fr: '1fr' },
  { id: 'role', label: 'Contact type', fr: '1.1fr' },
  { id: 'status', label: 'Status', fr: '0.9fr' },
  { id: 'type', label: 'Type', fr: '0.9fr' },
  { id: 'time', label: 'Schedule', fr: '0.85fr' },
  { id: 'reports', label: 'Reports to', fr: '1.3fr' },
  { id: 'joined', label: 'Joined', fr: '1fr' },
  { id: 'rate', label: 'Internal rate', fr: '0.95fr', align: 'right' },
  { id: 'tsheets', label: 'TSheets', fr: '1fr' },
]
const DEFAULT_COLS: ColId[] = ['team', 'reports', 'joined', 'rate', 'status', 'tsheets']
const LS_COLS = 'tn-directory-cols-v2'

const primaryEmail = (p: PersonView) => p.emails.trueNorth || p.emails.goodnews || p.emails.coe || p.emails.personal || ''

function PillBadge({ pill }: { pill: Pill }) {
  return (
    <span className={`inline-flex items-center font-(family-name:--font-display) font-extrabold text-[11px] rounded-[7px] px-3 py-[5px] whitespace-nowrap ${PILL_CLASS[pill.kind]}`}>{pill.label}</span>
  )
}

export function PeopleManager({ people, teamOptions, onOpen }: { people: PersonView[]; teamOptions: TeamOption[]; onOpen: (id: string) => void }) {
  const [q, setQ] = useState('')
  const [conds, setConds] = useState<FilterCond[]>([])
  const [sort, setSort] = useState<SortState | null>(null)
  const [cols, setCols] = useState<ColId[]>(DEFAULT_COLS)
  const [colMenu, setColMenu] = useState(false)

  // Filterable/sortable columns, a superset of the visible table columns, so you
  // can filter or sort by anything even when the column is hidden. Person = name.
  const filterColumns = useMemo<GridColumn<PersonView>[]>(() => [
    { id: 'name', label: 'Name', type: 'text', get: p => p.full_name },
    { id: 'team', label: 'Team', type: 'enum', get: p => p.teamName, options: teamOptions.map(t => ({ value: t.name, label: t.name })) },
    { id: 'role', label: 'Contact type', type: 'enum', get: p => p.roleType, options: ROLE_TYPE_OPTIONS.map(v => ({ value: v, label: ROLE_TYPE_LABEL[v] })) },
    { id: 'job', label: 'Job title', type: 'text', get: p => p.title },
    { id: 'reports', label: 'Reports to', type: 'text', get: p => p.managerName },
    { id: 'type', label: 'Type', type: 'enum', get: p => p.employmentType, options: [{ value: 'us', label: 'US Employee' }, { value: 'contractor', label: 'Contractor' }] },
    { id: 'time', label: 'Schedule', type: 'enum', get: p => p.schedule, options: [{ value: 'full', label: 'Full-Time' }, { value: 'part', label: 'Part-Time' }] },
    { id: 'joined', label: 'Joined', type: 'date', get: p => p.hireDate },
    { id: 'rate', label: 'Internal rate', type: 'number', get: p => p.internalRate },
    { id: 'status', label: 'Status', type: 'enum', get: p => p.status, options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
    { id: 'tsheets', label: 'TSheets', type: 'enum', get: p => (p.hasTsheets ? 'linked' : 'unlinked'), options: [{ value: 'linked', label: 'Linked' }, { value: 'unlinked', label: 'Not linked' }] },
  ], [teamOptions])

  // Hydrate saved column choices once on mount. Deliberately a post-mount effect
  // (not a lazy initializer) so the server and first client render agree, then we
  // adopt localStorage, avoids an SSR/hydration mismatch on the table columns.
  useEffect(() => {
    try {
      const rawV2 = window.localStorage.getItem(LS_COLS)
      if (rawV2) {
        const arr = JSON.parse(rawV2)
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time localStorage hydration
        if (Array.isArray(arr)) setCols(COLUMNS.filter(c => arr.includes(c.id)).map(c => c.id))
        return
      }
      // Migrate v1 → v2 once, forcing the new TSheets column into everyone's set
      // (later toggles are saved to v2, so it can still be hidden afterwards).
      const rawV1 = window.localStorage.getItem('tn-directory-cols-v1')
      if (rawV1) {
        const arr = JSON.parse(rawV1)
        if (Array.isArray(arr)) {
          const merged = COLUMNS.filter(c => arr.includes(c.id) || c.id === 'tsheets').map(c => c.id)
          setCols(merged)
          window.localStorage.setItem(LS_COLS, JSON.stringify(merged))
        }
      }
    } catch {}
  }, [])

  function toggleCol(id: ColId) {
    setCols(cur => {
      const next = cur.includes(id) ? cur.filter(x => x !== id) : COLUMNS.filter(c => cur.includes(c.id) || c.id === id).map(c => c.id)
      try { window.localStorage.setItem(LS_COLS, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    const base = term
      ? people.filter(p => `${p.full_name} ${p.title ?? ''} ${p.teamName ?? ''} ${primaryEmail(p)}`.toLowerCase().includes(term))
      : people
    return applyFilters(base, filterColumns, conds)
  }, [people, q, conds, filterColumns])

  const visCols = COLUMNS.filter(c => cols.includes(c.id))
  const gridTemplate = `2fr ${visCols.map(c => c.fr).join(' ')}`
  // Sort is applied WITHIN each group so the Active / Inactive split is preserved.
  const groups = [
    { key: 'active', label: 'Active', on: true, rows: applySort(filtered.filter(p => p.status === 'active'), filterColumns, sort) },
    { key: 'inactive', label: 'Inactive', on: false, rows: applySort(filtered.filter(p => p.status === 'inactive'), filterColumns, sort) },
  ].filter(g => g.rows.length > 0)

  const inactiveCount = people.filter(p => p.status === 'inactive').length

  return (
    <div>
      {/* toolbar */}
      <div className="flex items-center gap-3.5 flex-wrap mb-[18px]">
        <div className="relative flex-1 min-w-[230px] max-w-[340px]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="absolute left-[13px] top-1/2 -translate-y-1/2 text-muted"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search people…"
            className="w-full text-sm text-tn-ink bg-white border border-slate-200 rounded-[11px] pl-[38px] pr-3.5 py-[11px] focus:outline-none focus:border-tn-teal"
          />
        </div>

        {/* filter builder, "filter by anything" (replaces the fixed team + status pills) */}
        <FilterBar columns={filterColumns} conds={conds} onChange={setConds} />

        {/* columns control */}
        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() => setColMenu(v => !v)}
            className="inline-flex items-center gap-2 font-(family-name:--font-display) font-extrabold text-[12.5px] text-foreground bg-white border border-slate-200 rounded-full px-3.5 py-[7px] transition-all hover:border-tn-teal hover:text-tn-teal"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18" /></svg>
            Columns
            <span className="font-(family-name:--font-display) font-extrabold text-[11px] text-muted bg-subtle rounded-full px-[7px] py-px">{visCols.length}</span>
          </button>
          {colMenu && (
            <>
              <div onClick={() => setColMenu(false)} className="fixed inset-0 z-30" />
              <div className="absolute top-[calc(100%+8px)] right-0 z-[31] w-[230px] bg-white border border-slate-200 rounded-[13px] shadow-[0_24px_60px_-22px_rgba(1,35,88,.5)] p-2">
                <div className="font-(family-name:--font-display) font-extrabold text-[9.5px] tracking-[.07em] uppercase text-muted px-2.5 pt-1.5 pb-2">Show columns</div>
                <div className="flex items-center gap-2.5 p-2.5 rounded-[9px] opacity-65">
                  <span className="shrink-0 w-[18px] h-[18px] rounded-md bg-tn-teal inline-flex items-center justify-center text-white"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg></span>
                  <span className="font-(family-name:--font-display) font-bold text-[13px] text-tn-ink">Person</span>
                  <span className="ml-auto text-[10.5px] font-bold text-muted">Always</span>
                </div>
                {COLUMNS.map(c => {
                  const on = cols.includes(c.id)
                  return (
                    <button key={c.id} type="button" onClick={() => toggleCol(c.id)} className="flex items-center gap-2.5 w-full p-2.5 rounded-[9px] text-left transition-colors hover:bg-subtle">
                      <span className={`shrink-0 w-[18px] h-[18px] rounded-md inline-flex items-center justify-center transition-all ${on ? 'bg-tn-teal text-white border border-tn-teal' : 'bg-transparent text-transparent border-[1.5px] border-slate-300'}`}>
                        {on && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>}
                      </span>
                      <span className="font-(family-name:--font-display) font-bold text-[13px] text-tn-ink">{c.label}</span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* table */}
      <div className="border border-slate-200 bg-white rounded-[16px] overflow-hidden shadow-[0_1px_2px_rgba(1,35,88,.06)]">
        <div className="grid gap-3.5 items-center px-[22px] py-[13px] bg-subtle border-b border-slate-200" style={{ gridTemplateColumns: gridTemplate }}>
          <SortHeader label="Person" active={sort?.id === 'name'} dir={sort?.id === 'name' ? sort.dir : null} onClick={() => setSort(s => nextSort(s, 'name'))} />
          {visCols.map(c => (
            <SortHeader key={c.id} label={c.label} align={c.align} active={sort?.id === c.id} dir={sort?.id === c.id ? sort.dir : null} onClick={() => setSort(s => nextSort(s, c.id))} />
          ))}
        </div>

        {groups.map(g => (
          <div key={g.key}>
            <div className="flex items-center gap-2.5 px-[22px] py-[11px] bg-subtle border-t border-slate-200">
              <span className="w-2 h-2 rounded-full" style={{ background: g.on ? '#1f8a5b' : '#c3ccd6' }} />
              <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-wide uppercase text-muted">{g.label}</span>
              <span className="font-(family-name:--font-display) font-extrabold text-[11px] text-muted bg-subtle rounded-full px-2 py-px">{g.rows.length}</span>
            </div>
            {g.rows.map((p, i) => (
              <div
                key={p.id}
                onClick={() => onOpen(p.id)}
                className={`grid gap-3.5 items-center px-[22px] py-[13px] cursor-pointer transition-colors hover:bg-subtle ${i === 0 ? '' : 'border-t border-slate-200'}`}
                style={{ gridTemplateColumns: gridTemplate }}
              >
                <span className="inline-flex items-center gap-3 min-w-0">
                  <Avatar name={p.full_name} avatarUrl={p.avatarUrl} size={38} color={TEAM_COLOR[p.teamKey]} dimmed={p.status === 'inactive'} />
                  <span className="min-w-0">
                    <span className="block font-(family-name:--font-display) font-bold text-sm text-tn-ink truncate">{p.full_name}</span>
                    <span className="block text-xs text-muted truncate">{primaryEmail(p) || '-'}</span>
                  </span>
                </span>
                {visCols.map(c => (
                  <Cell key={c.id} col={c} p={p} />
                ))}
              </div>
            ))}
          </div>
        ))}

        {groups.length === 0 && (
          <div className="px-[22px] py-[52px] text-center"><p className="text-sm text-muted">No people match this filter.</p></div>
        )}
      </div>

      <p className="text-[12.5px] text-muted mt-3.5 mx-0.5">
        {filtered.length} of {people.length} people{inactiveCount ? ` · ${inactiveCount} inactive` : ''}
      </p>
    </div>
  )
}

function Cell({ col, p }: { col: { id: ColId; align?: 'right' }; p: PersonView }) {
  const wrap = `inline-flex items-center gap-2 min-w-0 ${col.align === 'right' ? 'justify-end' : ''}`

  if (col.id === 'team') return <span className={wrap}><span className="inline-flex items-center font-(family-name:--font-display) font-extrabold text-[10px] tracking-wide uppercase rounded-full px-[11px] py-1 whitespace-nowrap" style={{ color: TEAM_COLOR[p.teamKey], background: `${TEAM_COLOR[p.teamKey]}1a` }}>{p.teamName ?? '-'}</span></span>
  if (col.id === 'role') return <span className={wrap}><PillBadge pill={roleTypePill(p.roleType)} /></span>
  if (col.id === 'job') return <span className={wrap}><span className="text-[13px] text-foreground truncate">{p.title ?? '-'}</span></span>
  if (col.id === 'joined') return <span className={wrap}><span className="text-[13px] text-foreground truncate">{formatDate(p.hireDate) ?? '-'}</span></span>
  if (col.id === 'rate') return <span className={wrap}><span className="text-[13.5px] font-bold tabular-nums text-tn-ink">{p.internalRate != null ? `$${p.internalRate}` : '-'}</span></span>
  if (col.id === 'type') { const pill = typePill(p.employmentType); return <span className={wrap}>{pill ? <PillBadge pill={pill} /> : <span className="text-[13px] text-muted">-</span>}</span> }
  if (col.id === 'time') { const pill = timePill(p.schedule); return <span className={wrap}>{pill ? <PillBadge pill={pill} /> : <span className="text-[13px] text-muted">-</span>}</span> }
  if (col.id === 'reports') {
    if (!p.managerName) return <span className={wrap}><span className="text-[12.5px] text-muted italic">-</span></span>
    return (
      <span className={wrap}>
        <span className="shrink-0 inline-flex items-center justify-center rounded-full text-white font-(family-name:--font-display) font-extrabold text-[10px]" style={{ width: 26, height: 26, background: TEAM_COLOR[p.managerTeamKey ?? 'other'] }}>{initialsOf(p.managerName)}</span>
        <span className="text-[13px] text-foreground truncate">{p.managerName}</span>
      </span>
    )
  }
  if (col.id === 'status') {
    const active = p.status === 'active'
    return (
      <span className={wrap}>
        <span className="inline-flex items-center gap-1.5 font-(family-name:--font-display) font-extrabold text-[11px]" style={{ color: active ? '#1f8a5b' : undefined }}>
          <span className="w-[7px] h-[7px] rounded-full" style={{ background: active ? '#1f8a5b' : '#c3ccd6' }} />
          <span className={active ? '' : 'text-muted'}>{active ? 'Active' : 'Inactive'}</span>
        </span>
      </span>
    )
  }
  if (col.id === 'tsheets') return <span className={wrap}><PillBadge pill={p.hasTsheets ? { kind: 'green', label: 'Linked' } : { kind: 'grey', label: 'Not linked' }} /></span>
  return null
}
