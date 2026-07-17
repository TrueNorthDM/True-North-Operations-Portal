'use client'

/**
 * PeopleManager — the People tab of the Directory. A searchable, filterable,
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
  type PersonView,
  type Pill,
} from './people-types'
import { Avatar } from '@/components/Avatar'
import type { TeamOption } from './DirectoryTabs'

type ColId = 'team' | 'role' | 'job' | 'reports' | 'type' | 'time' | 'joined' | 'rate' | 'status'

const COLUMNS: { id: ColId; label: string; fr: string; align?: 'right' }[] = [
  { id: 'team', label: 'Team', fr: '1fr' },
  { id: 'role', label: 'Contact type', fr: '1.1fr' },
  { id: 'job', label: 'Job title', fr: '1.2fr' },
  { id: 'reports', label: 'Reports to', fr: '1.3fr' },
  { id: 'type', label: 'Type', fr: '0.9fr' },
  { id: 'time', label: 'Schedule', fr: '0.85fr' },
  { id: 'joined', label: 'Joined', fr: '1fr' },
  { id: 'rate', label: 'Internal rate', fr: '0.95fr', align: 'right' },
  { id: 'status', label: 'Status', fr: '0.9fr' },
]
const DEFAULT_COLS: ColId[] = ['team', 'reports', 'joined', 'rate', 'status']
const LS_COLS = 'tn-directory-cols-v1'

const primaryEmail = (p: PersonView) => p.emails.trueNorth || p.emails.goodnews || p.emails.coe || p.emails.personal || ''

function PillBadge({ pill }: { pill: Pill }) {
  return (
    <span className={`inline-flex items-center font-(family-name:--font-display) font-extrabold text-[11px] rounded-[7px] px-3 py-[5px] whitespace-nowrap ${PILL_CLASS[pill.kind]}`}>{pill.label}</span>
  )
}

// Compact contact-type tag shown next to the name (only for non-user roles).
function RoleTag({ roleType }: { roleType: string }) {
  const pill = roleTypePill(roleType)
  return <span className={`shrink-0 inline-flex items-center font-(family-name:--font-display) font-extrabold text-[9px] tracking-wide uppercase rounded-[5px] px-1.5 py-0.5 whitespace-nowrap ${PILL_CLASS[pill.kind]}`}>{pill.label}</span>
}

export function PeopleManager({ people, teamOptions, onOpen }: { people: PersonView[]; teamOptions: TeamOption[]; onOpen: (id: string) => void }) {
  const [q, setQ] = useState('')
  const [teamFilter, setTeamFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [cols, setCols] = useState<ColId[]>(DEFAULT_COLS)
  const [colMenu, setColMenu] = useState(false)

  // Hydrate saved column choices once on mount. Deliberately a post-mount effect
  // (not a lazy initializer) so the server and first client render agree, then we
  // adopt localStorage — avoids an SSR/hydration mismatch on the table columns.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LS_COLS)
      if (raw) {
        const arr = JSON.parse(raw)
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time localStorage hydration
        if (Array.isArray(arr)) setCols(COLUMNS.filter(c => arr.includes(c.id)).map(c => c.id))
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
    return people.filter(p => {
      if (teamFilter !== 'all' && p.teamId !== teamFilter) return false
      if (statusFilter === 'active' && p.status !== 'active') return false
      if (statusFilter === 'inactive' && p.status !== 'inactive') return false
      if (term) {
        const hay = `${p.full_name} ${p.title ?? ''} ${p.teamName ?? ''} ${primaryEmail(p)}`.toLowerCase()
        if (!hay.includes(term)) return false
      }
      return true
    })
  }, [people, q, teamFilter, statusFilter])

  const visCols = COLUMNS.filter(c => cols.includes(c.id))
  const gridTemplate = `2fr ${visCols.map(c => c.fr).join(' ')}`
  const groups = [
    { key: 'active', label: 'Active', on: true, rows: filtered.filter(p => p.status === 'active') },
    { key: 'inactive', label: 'Inactive', on: false, rows: filtered.filter(p => p.status === 'inactive') },
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

        {/* team filter pills */}
        <div className="flex gap-[7px] flex-wrap">
          {[{ id: 'all', name: 'All', color: '' }, ...teamOptions].map(f => {
            const active = teamFilter === f.id
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setTeamFilter(f.id)}
                className={`inline-flex items-center gap-[7px] font-(family-name:--font-display) font-extrabold text-[12.5px] rounded-full px-3.5 py-[7px] border transition-all ${
                  active ? 'border-tn-teal bg-tn-teal-soft text-tn-teal' : 'border-slate-200 bg-white text-foreground hover:border-tn-teal'
                }`}
              >
                {f.color && <span className="w-2 h-2 rounded-[2px]" style={{ background: f.color }} />}
                {f.name}
              </button>
            )
          })}
        </div>

        {/* active/inactive segment */}
        <div className="flex items-center bg-subtle border border-slate-200 rounded-[10px] p-[3px]">
          {(['all', 'active', 'inactive'] as const).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`font-(family-name:--font-display) font-extrabold text-xs rounded-lg px-[13px] py-1.5 transition-all capitalize ${
                statusFilter === s ? 'bg-white text-tn-teal shadow-[0_1px_3px_rgba(1,35,88,.14)]' : 'text-muted'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

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
          <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-wide uppercase text-muted">Person</span>
          {visCols.map(c => (
            <span key={c.id} className={`font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-wide uppercase text-muted ${c.align === 'right' ? 'text-right' : ''}`}>{c.label}</span>
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
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="font-(family-name:--font-display) font-bold text-sm text-tn-ink truncate">{p.full_name}</span>
                      {p.roleType !== 'user' && <RoleTag roleType={p.roleType} />}
                    </span>
                    <span className="block text-xs text-muted truncate">{primaryEmail(p) || '—'}</span>
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

  if (col.id === 'team') return <span className={wrap}><span className="inline-flex items-center font-(family-name:--font-display) font-extrabold text-[10px] tracking-wide uppercase rounded-full px-[11px] py-1 whitespace-nowrap" style={{ color: TEAM_COLOR[p.teamKey], background: `${TEAM_COLOR[p.teamKey]}1a` }}>{p.teamName ?? '—'}</span></span>
  if (col.id === 'role') return <span className={wrap}><PillBadge pill={roleTypePill(p.roleType)} /></span>
  if (col.id === 'job') return <span className={wrap}><span className="text-[13px] text-foreground truncate">{p.title ?? '—'}</span></span>
  if (col.id === 'joined') return <span className={wrap}><span className="text-[13px] text-foreground truncate">{formatDate(p.hireDate) ?? '—'}</span></span>
  if (col.id === 'rate') return <span className={wrap}><span className="text-[13.5px] font-bold tabular-nums text-tn-ink">{p.internalRate != null ? `$${p.internalRate}` : '—'}</span></span>
  if (col.id === 'type') { const pill = typePill(p.employmentType); return <span className={wrap}>{pill ? <PillBadge pill={pill} /> : <span className="text-[13px] text-muted">—</span>}</span> }
  if (col.id === 'time') { const pill = timePill(p.schedule); return <span className={wrap}>{pill ? <PillBadge pill={pill} /> : <span className="text-[13px] text-muted">—</span>}</span> }
  if (col.id === 'reports') {
    if (!p.managerName) return <span className={wrap}><span className="text-[12.5px] text-muted italic">—</span></span>
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
  return null
}
