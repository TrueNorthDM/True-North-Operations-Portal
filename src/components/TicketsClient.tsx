'use client'

/**
 * TicketsClient — renders the dev work tracker (data from lib/tickets/data.ts).
 * Search + type/status filters live as local state (instant, no network). The
 * data is maintained in the repo by Claude; this view is read-only.
 */

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  TICKETS,
  TYPE_META,
  STATUS_META,
  PRIORITY_META,
  STATUS_ORDER,
  type TicketStatus,
  type TicketType,
} from '@/lib/tickets/data'

const ALL_TYPES: TicketType[] = ['task', 'bug', 'feature', 'chore', 'idea']

export function TicketsClient() {
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

  const hasFilter = !!(search || filType || filStatus)

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <Link href="/" className="hover:text-slate-800">Dashboard</Link>
          <span>/</span>
          <Link href="/admin" className="hover:text-slate-800">Admin</Link>
          <span>/</span>
          <span>Tickets</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Tickets</h1>
        <p className="mt-1 text-sm text-slate-500">Everything we need to resolve — so nothing gets lost.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Total" value={counts.total} cls="bg-slate-800 text-white" />
        <Stat label="In progress" value={counts.in_progress} cls="bg-amber-600 text-white" />
        <Stat label="Blocked" value={counts.blocked} cls="bg-red-600 text-white" />
        <Stat label="Backlog" value={counts.backlog} cls="bg-slate-500 text-white" />
        <Stat label="Done" value={counts.done} cls="bg-green-700 text-white" />
        <Stat label="Won’t do" value={counts.wont_do} cls="bg-slate-400 text-white" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search tickets…"
          className="w-56 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
        <select
          value={filType}
          onChange={e => setFilType(e.target.value as TicketType | '')}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">All types</option>
          {ALL_TYPES.map(t => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
        </select>
        <select
          value={filStatus}
          onChange={e => setFilStatus(e.target.value as TicketStatus | '')}
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">All statuses</option>
          {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
        {hasFilter && (
          <button
            type="button"
            onClick={() => { setSearch(''); setFilType(''); setFilStatus('') }}
            className="px-3 py-2 text-xs font-medium text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Clear
          </button>
        )}
        <span className="text-xs text-slate-400 ml-auto">Showing {filtered.length} of {TICKETS.length}</span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-sm text-slate-400">
          No tickets match the current filters.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 w-20">Code</th>
                <th className="px-4 py-3 w-20">Type</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3 w-28">Area</th>
                <th className="px-4 py-3 w-20">Priority</th>
                <th className="px-4 py-3 w-32">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const sm = STATUS_META[t.status]
                const archived = t.status === 'done' || t.status === 'wont_do'
                return (
                  <tr key={t.code} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/60 ${archived ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap align-top">{t.code}</td>
                    <td className="px-4 py-3 align-top">
                      <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_META[t.type].cls}`}>
                        {TYPE_META[t.type].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-slate-800">{t.title}</div>
                      {t.description && <div className="mt-0.5 text-xs text-slate-500">{t.description}</div>}
                      {t.notes && <div className="mt-0.5 text-xs text-slate-400 italic">{t.notes}</div>}
                      {t.commit && <div className="mt-0.5 text-[11px] font-mono text-slate-400">{t.commit}</div>}
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-slate-500">{t.area}</td>
                    <td className={`px-4 py-3 align-top text-xs font-medium ${PRIORITY_META[t.priority].cls}`}>{PRIORITY_META[t.priority].label}</td>
                    <td className="px-4 py-3 align-top">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${sm.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />
                        {sm.label}
                      </span>
                    </td>
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

function Stat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={`rounded-xl px-4 py-3 ${cls}`}>
      <div className="text-2xl font-bold leading-none">{value ?? 0}</div>
      <div className="text-[11px] mt-1 opacity-90">{label}</div>
    </div>
  )
}
