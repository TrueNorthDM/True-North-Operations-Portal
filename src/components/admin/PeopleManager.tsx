'use client'

/**
 * PeopleManager: the People tab of the Directory. A searchable, filterable,
 * column-configurable roster grouped into Active / Inactive. Rows open the
 * shared person modal (owned by DirectoryTabs). Which columns show is kept in
 * the person's account since 25 October 2026 (lib/settings/columns.ts), no
 * longer in each browser.
 */

import { useMemo, useState } from 'react'
import { SearchField } from '@/components/ui/SearchField'
import {
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
} from '@/lib/directory/people-types'
import { Avatar } from '@/components/Avatar'
import { teamColour } from '@/lib/directory/team-colour'
import type { TeamOption } from './DirectoryTabs'
import { FilterBar } from './grid/FilterBar'
import { SortHeader } from './grid/SortHeader'
import { applyFilters, applySort, nextSort } from './grid/utils'
import type { FilterCond, GridColumn, SortState } from './grid/types'
import { ColumnsMenu, useColumnChoice, type ColumnChoice } from '@/components/ui/ColumnsMenu'
import { fixedOf, layoutColumns } from '@/lib/settings/columns'

type ColId = 'team' | 'role' | 'job' | 'reports' | 'type' | 'time' | 'joined' | 'status' | 'tsheets'

// Ordered to match the contact card (components/admin/RestrictedDirectory →
// ProfileCard, the same layout as My profile), so scanning a row and reading a
// card follow the same sequence:
//   header      job title, team, access level, status
//   Employment  type, schedule
//   Reporting   reports to
//   Dates       joined
// TSheets closes the row: it is not in that sequence. (The internal rate lives
// in Rates & Costs alone since 8 October 2026.)
//
// The visible set is filtered THROUGH this array, so changing the order here
// reorders every table, including column choices already saved.
const COLUMNS: { id: ColId; label: string; fr: string; align?: 'right' }[] = [
  { id: 'job', label: 'Job title', fr: '1.2fr' },
  { id: 'team', label: 'Team', fr: '1fr' },
  { id: 'role', label: 'Access level', fr: '1.1fr' },
  { id: 'status', label: 'Status', fr: '0.9fr' },
  { id: 'type', label: 'Type', fr: '0.9fr' },
  { id: 'time', label: 'Schedule', fr: '0.85fr' },
  { id: 'reports', label: 'Reports to', fr: '1.3fr' },
  { id: 'joined', label: 'Joined', fr: '1fr' },
  { id: 'tsheets', label: 'TSheets', fr: '1fr' },
]
/** Read from the Work tab: without that item they are not on the list at all. */
const WORK_COLS = new Set<ColId>(['type', 'time', 'joined'])
// Person first and fixed; the shown columns after it (the default set is in lib/settings/columns.ts).
const PERSON = { key: 'person', label: 'Person', track: '2fr', min: 0 }

const primaryEmail = (p: PersonView) => p.emails.trueNorth || p.emails.goodnews || p.emails.coe || ''

function PillBadge({ pill }: { pill: Pill }) {
  return (
    <span className={`inline-flex items-center font-(family-name:--font-display) font-extrabold text-[11px] rounded-[7px] px-3 py-[5px] whitespace-nowrap ${PILL_CLASS[pill.kind]}`}>{pill.label}</span>
  )
}

export function PeopleManager({ people, teamOptions, workColumns, onOpen, columns: given }: {
  people: PersonView[]
  teamOptions: TeamOption[]
  workColumns: boolean
  onOpen: (id: string) => void
  /** Which columns this person hides (Columns menu); kept on this screen only when absent. */
  columns?: ColumnChoice
}) {
  // The internal rate lives in Rates & Costs alone (8 October 2026), not on this list.
  const columns = useMemo(() => (workColumns ? COLUMNS : COLUMNS.filter(c => !WORK_COLS.has(c.id))), [workColumns])
  // The manager's avatar takes the manager's own colour, the one on their row.
  const colourOf = useMemo(() => {
    const byId = new Map(people.map(p => [p.id, p.color]))
    return (id: string | null) => (id && byId.get(id)) || teamColour(null, null)
  }, [people])
  const [q, setQ] = useState('')
  const [conds, setConds] = useState<FilterCond[]>([])
  const [sort, setSort] = useState<SortState | null>(null)
  const choice = useColumnChoice('directory-people', given)

  // Filterable/sortable columns, a superset of the visible table columns, so you
  // can filter or sort by anything even when the column is hidden. Person = name.
  const filterColumns = useMemo<GridColumn<PersonView>[]>(() => ([
    { id: 'name', label: 'Name', type: 'text', get: p => p.full_name },
    { id: 'team', label: 'Team', type: 'enum', get: p => p.teamName, options: teamOptions.map(t => ({ value: t.name, label: t.name })) },
    { id: 'role', label: 'Access level', type: 'enum', get: p => p.roleType, options: ROLE_TYPE_OPTIONS.map(v => ({ value: v, label: ROLE_TYPE_LABEL[v] })) },
    { id: 'job', label: 'Job title', type: 'text', get: p => p.title },
    { id: 'reports', label: 'Reports to', type: 'text', get: p => p.managerName },
    { id: 'type', label: 'Type', type: 'enum', get: p => p.employmentType, options: [{ value: 'us', label: 'US Employee' }, { value: 'contractor', label: 'Contractor' }] },
    { id: 'time', label: 'Schedule', type: 'enum', get: p => p.schedule, options: [{ value: 'full', label: 'Full-Time' }, { value: 'part', label: 'Part-Time' }] },
    { id: 'joined', label: 'Joined', type: 'date', get: p => p.hireDate },
    { id: 'status', label: 'Status', type: 'enum', get: p => p.status, options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
    { id: 'tsheets', label: 'TSheets', type: 'enum', get: p => (p.hasTsheets ? 'linked' : 'unlinked'), options: [{ value: 'linked', label: 'Linked' }, { value: 'unlinked', label: 'Not linked' }] },
  ] satisfies GridColumn<PersonView>[]).filter(c => workColumns || !WORK_COLS.has(c.id as ColId)), [teamOptions, workColumns])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    const base = term
      ? people.filter(p => `${p.full_name} ${p.title ?? ''} ${p.teamName ?? ''} ${primaryEmail(p)}`.toLowerCase().includes(term))
      : people
    return applyFilters(base, filterColumns, conds)
  }, [people, q, conds, filterColumns])

  const menuColumns = useMemo(() => [PERSON, ...columns.map(c => ({ key: c.id, label: c.label, track: c.fr, min: 0 }))], [columns])
  const layout = layoutColumns(menuColumns, choice.hidden, fixedOf('directory-people'), { gap: 14, padX: 44 })
  const visCols = columns.filter(c => layout.visible.some(v => v.key === c.id))
  const gridTemplate = layout.template
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
        <SearchField
          value={q}
          onChange={setQ}
          placeholder="Search people…"
          className="flex-1 min-w-[230px] max-w-[340px]"
        />

        {/* filter builder, "filter by anything" (replaces the fixed team + status pills) */}
        <FilterBar columns={filterColumns} conds={conds} onChange={setConds} />

        {/* columns control: which columns show, kept in the person's account */}
        <ColumnsMenu columns={menuColumns} fixed={fixedOf('directory-people')} choice={choice} />
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
                role="link"
                tabIndex={0}
                aria-label={`Open ${p.full_name}`}
                onClick={() => onOpen(p.id)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onOpen(p.id) } }}
                className={`grid gap-3.5 items-center px-[22px] py-[13px] cursor-pointer transition-colors hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-2 focus-visible:outline-tn-teal focus-visible:-outline-offset-2 ${i === 0 ? '' : 'border-t border-slate-200'}`}
                style={{ gridTemplateColumns: gridTemplate }}
              >
                <span className="inline-flex items-center gap-3 min-w-0">
                  <Avatar name={p.full_name} avatarUrl={p.avatarUrl} size={38} color={p.color} dimmed={p.status === 'inactive'} />
                  <span className="min-w-0">
                    <span className="block font-(family-name:--font-display) font-bold text-sm text-tn-ink truncate">{p.full_name}</span>
                    <span className="block text-xs text-muted truncate">{primaryEmail(p) || '-'}</span>
                  </span>
                </span>
                {visCols.map(c => (
                  <Cell key={c.id} col={c} p={p} colourOf={colourOf} />
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

function Cell({ col, p, colourOf }: { col: { id: ColId; align?: 'right' }; p: PersonView; colourOf: (id: string | null) => string }) {
  const wrap = `inline-flex items-center gap-2 min-w-0 ${col.align === 'right' ? 'justify-end' : ''}`

  if (col.id === 'team') return <span className={wrap}><span className="inline-flex items-center font-(family-name:--font-display) font-extrabold text-[10px] tracking-wide uppercase rounded-full px-[11px] py-1 whitespace-nowrap" style={{ color: p.color, background: `${p.color}1a` }}>{p.teamName ?? '-'}</span></span>
  if (col.id === 'role') return <span className={wrap}><PillBadge pill={roleTypePill(p.roleType)} /></span>
  if (col.id === 'job') return <span className={wrap}><span className="text-[13px] text-foreground truncate">{p.title ?? '-'}</span></span>
  if (col.id === 'joined') return <span className={wrap}><span className="text-[13px] text-foreground truncate">{formatDate(p.hireDate) ?? '-'}</span></span>
  if (col.id === 'type') { const pill = typePill(p.employmentType); return <span className={wrap}>{pill ? <PillBadge pill={pill} /> : <span className="text-[13px] text-muted">-</span>}</span> }
  if (col.id === 'time') { const pill = timePill(p.schedule); return <span className={wrap}>{pill ? <PillBadge pill={pill} /> : <span className="text-[13px] text-muted">-</span>}</span> }
  if (col.id === 'reports') {
    if (!p.managerName) return <span className={wrap}><span className="text-[12.5px] text-muted italic">-</span></span>
    return (
      <span className={wrap}>
        <span className="shrink-0 inline-flex items-center justify-center rounded-full text-white font-(family-name:--font-display) font-extrabold text-[10px]" style={{ width: 26, height: 26, background: colourOf(p.manager_id) }}>{initialsOf(p.managerName)}</span>
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
