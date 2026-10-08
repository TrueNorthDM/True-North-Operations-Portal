'use client'

/**
 * TicketsClient: the dev work tracker (data from lib/tickets/data.ts).
 * Search + type/status filters live as local state (instant, no network); the
 * stat cards double as status filters. Read-only view, the data is maintained
 * in the repo. Styling matches the handoff prototype.
 */

import { SearchField } from '@/components/ui/SearchField'
import { useMemo, useState } from 'react'
import { Select } from '@/components/ui/Select'
import { Breadcrumb, adminCrumb } from '@/components/ui/Breadcrumb'
import {
  TICKETS,
  TYPE_META,
  STATUS_META,
  PRIORITY_META,
  STATUS_ORDER,
  type TicketStatus,
  type TicketType,
  type TicketPriority,
} from '@/lib/tickets/data'

const ALL_TYPES: TicketType[] = ['task', 'bug', 'feature', 'chore', 'idea']

// Literal colours (same in light & dark, like the prototype's badges).
const STAT_BG: Record<'total' | TicketStatus, string> = {
  total: 'var(--color-stat-total)', in_progress: '#E8850C', blocked: '#E11D2A',
  backlog: '#5b6b82', done: '#127A3E', wont_do: '#94a1b2',
}
// Each badge maps to a "tone" whose colours live in globals.css as CSS vars
// (--bdg-<tone>-bg / -fg / -active), so the palette mirror brightens them in dark.
const bg = (tone: string) => `var(--bdg-${tone}-bg)`
const fg = (tone: string) => `var(--bdg-${tone}-fg)`
const active = (tone: string) => `var(--bdg-${tone}-active)`

const TYPE_TONE: Record<TicketType, string> = {
  task: 'tslate', chore: 'tslate', feature: 'purple', idea: 'gold', bug: 'bug',
}
const STATUS_TONE: Record<TicketStatus, string> = {
  in_progress: 'orange', blocked: 'red', backlog: 'slate', done: 'dgreen', wont_do: 'gslate',
}
const PRIO_TONE: Record<TicketPriority, { level: number; tone: string }> = {
  high: { level: 3, tone: 'red' }, medium: { level: 2, tone: 'orange' }, low: { level: 1, tone: 'green' },
}
const BAR_HEIGHTS = [5, 8, 11]

function TypePill({ type }: { type: TicketType }) {
  const t = TYPE_TONE[type]
  return (
    <span className="inline-flex items-center font-(family-name:--font-display) font-bold text-[11px] px-2 py-0.5 rounded-md whitespace-nowrap" style={{ background: bg(t), color: fg(t) }}>
      {TYPE_META[type].label}
    </span>
  )
}

function PriorityPill({ priority }: { priority: TicketPriority }) {
  const { level, tone } = PRIO_TONE[priority]
  return (
    <span className="inline-flex items-center gap-1.5 font-(family-name:--font-display) font-extrabold text-[11px] pl-2 pr-2.5 py-1 rounded-lg whitespace-nowrap" style={{ background: bg(tone), color: fg(tone) }}>
      <span className="inline-flex items-end gap-[2px] h-[11px]" aria-hidden="true">
        {BAR_HEIGHTS.map((h, i) => (
          <span key={i} className="w-[3px] rounded-[1px]" style={{ height: h, background: i < level ? active(tone) : 'var(--bdg-bar-muted)' }} />
        ))}
      </span>
      {PRIORITY_META[priority].label}
    </span>
  )
}

function StatusPill({ status }: { status: TicketStatus }) {
  const t = STATUS_TONE[status]
  return (
    <span className="inline-flex items-center gap-1.5 font-(family-name:--font-display) font-bold text-[11.5px] pl-2.5 pr-3 py-1 rounded-full whitespace-nowrap" style={{ background: bg(t), color: fg(t), boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${active(t)} 38%, transparent)` }}>
      <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: active(t), boxShadow: `0 0 0 3px ${bg(t)}` }} />
      {STATUS_META[status].label}
    </span>
  )
}

export function TicketsClient({ canOpenAdmin = true }: { canOpenAdmin?: boolean }) {
  const [search, setSearch] = useState('')
  const [filType, setFilType] = useState<TicketType | ''>('')
  const [filStatus, setFilStatus] = useState<TicketStatus | ''>('')

  const counts = useMemo(() => {
    const c = { total: TICKETS.length } as Record<string, number>
    for (const s of STATUS_ORDER) c[s] = TICKETS.filter(t => t.status === s).length
    return c
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return TICKETS.filter(t => {
      if (filType && t.type !== filType) return false
      if (filStatus && t.status !== filStatus) return false
      if (q && !(`${t.code} ${t.title} ${t.area} ${t.description ?? ''}`.toLowerCase().includes(q))) return false
      return true
    }).sort((a, b) => {
      const so = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
      return so !== 0 ? so : a.code.localeCompare(b.code)
    })
  }, [search, filType, filStatus])

  const STAT_CARDS: { key: 'total' | TicketStatus; label: string }[] = [
    { key: 'total', label: 'Total' },
    { key: 'in_progress', label: 'In progress' },
    { key: 'blocked', label: 'Blocked' },
    { key: 'backlog', label: 'Backlog' },
    { key: 'done', label: 'Done' },
    { key: 'wont_do', label: 'Won’t do' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb parents={[adminCrumb(canOpenAdmin)]} now="Tickets" />
        <h1 className="text-2xl font-(family-name:--font-display) font-extrabold tracking-tight text-tn-ink">Tickets</h1>
        <p className="mt-1.5 text-muted">Everything we need to resolve, so nothing gets lost.</p>
      </div>

      {/* Stat cards, each doubles as a status filter (Total clears it). */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STAT_CARDS.map(card => (
          <button
            key={card.key}
            type="button"
            onClick={() => setFilStatus(card.key === 'total' ? '' : card.key)}
            className="text-left rounded-[13px] px-[18px] py-4 text-[#ffffff] shadow-sm transition-transform hover:-translate-y-0.5"
            style={{ background: STAT_BG[card.key] }}
          >
            <div className="font-(family-name:--font-display) font-extrabold text-[28px] leading-none">
              {card.key === 'total' ? counts.total : (counts[card.key] ?? 0)}
            </div>
            <div className="text-[12.5px] font-semibold mt-[7px] opacity-85">{card.label}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search tickets…"
          className="flex-1 min-w-[220px] max-w-[340px]"
        />
        <Select
          value={filType}
          onChange={v => setFilType(v as TicketType | '')}
          options={[{ value: '', label: 'All types' }, ...ALL_TYPES.map(t => ({ value: t, label: TYPE_META[t].label }))]}
          ariaLabel="Filter by type"
          className="rounded-[10px] border border-slate-200 px-3.5 py-2.5 text-[13.5px] text-foreground bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-tn-teal/30"
        />
        <Select
          value={filStatus}
          onChange={v => setFilStatus(v as TicketStatus | '')}
          options={[{ value: '', label: 'All statuses' }, ...STATUS_ORDER.map(s => ({ value: s, label: STATUS_META[s].label }))]}
          ariaLabel="Filter by status"
          className="rounded-[10px] border border-slate-200 px-3.5 py-2.5 text-[13.5px] text-foreground bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-tn-teal/30"
        />
        <span className="text-[13px] text-muted ml-auto">Showing {filtered.length} of {TICKETS.length}</span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-sm text-muted">
          No tickets match the current filters.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-subtle text-left font-(family-name:--font-display) font-extrabold text-[10.5px] uppercase tracking-wide text-muted">
                <th className="px-5 py-3 w-20">Code</th>
                <th className="px-4 py-3 w-24">Type</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3 w-32">Area</th>
                <th className="px-4 py-3 w-24">Priority</th>
                <th className="px-4 py-3 w-28">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const archived = t.status === 'done' || t.status === 'wont_do'
                return (
                  <tr key={t.code} className={`border-b border-slate-100 last:border-0 hover:bg-subtle transition-colors ${archived ? 'opacity-60' : ''}`}>
                    <td className="px-5 py-4 text-[12.5px] text-muted tabular-nums whitespace-nowrap align-top">{t.code}</td>
                    <td className="px-4 py-4 align-top"><TypePill type={t.type} /></td>
                    <td className="px-4 py-4 align-top">
                      <div className="font-(family-name:--font-display) font-bold text-[14.5px] leading-snug text-tn-ink">{t.title}</div>
                      {t.description && <div className="mt-1 text-[12.5px] leading-relaxed text-muted">{t.description}</div>}
                      {t.notes && <div className="mt-1 text-[12px] leading-relaxed italic text-slate-400">{t.notes}</div>}
                      {t.commit && <div className="mt-1 text-[11px] font-mono text-slate-400">{t.commit}</div>}
                    </td>
                    <td className="px-4 py-4 align-top text-[12.5px] text-foreground">{t.area}</td>
                    <td className="px-4 py-4 align-top"><PriorityPill priority={t.priority} /></td>
                    <td className="px-4 py-4 align-top"><StatusPill status={t.status} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
