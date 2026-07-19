'use client'

import { useState } from 'react'
import { I7_PROJECTS } from '@/lib/tsheets/i7report'
import { PastScheduleTables } from './PastSchedule'
import { PILL_CLASS, initialsOf, type PillKind } from '@/components/admin/people-types'
import type { MonthlyBudget } from './MonthlyBudgetGrid'
import type { ProjectMonthHours } from './ProjectHoursGrid'

export interface AuditEntry {
  id: number
  entityType: string
  entityId: number
  action: string
  beforeData: Record<string, unknown> | null
  afterData: Record<string, unknown>
  justification: string
  changedAt: string
  /** Who made the change (profiles.full_name), resolved server-side. */
  actorName: string | null
  /** What was changed, the client/entity name, resolved server-side. */
  entityLabel: string | null
}

interface Props {
  entries: AuditEntry[]
  pastBudgets: MonthlyBudget[]
  pastProjectHours: ProjectMonthHours[]
}

const RECENT_LIMIT = 10

// ── What changed, the badge (real field) + an inline diff summary ──────────
type MonthRow = { month: string; budget_amount: number | null; extra_amount: number | null }

interface Change { badge: string; kind: PillKind; summary: string }

const num = (v: unknown) => (v == null || v === '' ? '-' : typeof v === 'number' ? `$${v.toLocaleString()}` : `$${v}`)
const arrow = (bv: unknown, av: unknown) => `${num(bv)} → ${num(av)}`

function describe(e: AuditEntry): Change {
  const b = e.beforeData ?? {}
  const a = e.afterData
  switch (e.entityType) {
    case 'assignment':
      return { badge: 'Hourly rate', kind: 'violet', summary: arrow(b.hourly_rate, a.hourly_rate) }
    case 'person_cost':
      return { badge: 'Cost rate', kind: 'violet', summary: arrow(b.cost_rate, a.cost_rate) }
    case 'person_salary':
      return { badge: 'Monthly salary', kind: 'violet', summary: arrow(b.monthly_salary, a.monthly_salary) }
    case 'project_budget':
    case 'project_month_hours':
      return { badge: 'Budget hours', kind: 'green', summary: 'updated per project' }
    case 'budget_history':
      return { badge: 'Budget history', kind: 'grey', summary: '' }
    case 'monthly_budget': {
      const before = (b.months as MonthRow[]) ?? []
      const after = (a.months as MonthRow[]) ?? []
      const bMap = new Map(before.map(m => [m.month, m.budget_amount]))
      const baseChanged = after.some(m => (bMap.get(m.month) ?? null) !== m.budget_amount)
      return baseChanged
        ? { badge: 'Budget', kind: 'blue', summary: 'monthly schedule' }
        : { badge: 'Extra', kind: 'amber', summary: 'monthly schedule' }
    }
    default: {
      if (b.budget_amount !== a.budget_amount) return { badge: 'Budget', kind: 'blue', summary: arrow(b.budget_amount, a.budget_amount) }
      if (b.extra_budget !== a.extra_budget) return { badge: 'Extra', kind: 'amber', summary: arrow(b.extra_budget, a.extra_budget) }
      if (b.start_date !== a.start_date || b.budget_end_date !== a.budget_end_date) {
        const s = a.start_date ? String(a.start_date) : '-'
        const en = a.budget_end_date ? String(a.budget_end_date) : 'ongoing'
        return { badge: 'Budget period', kind: 'teal', summary: `${s} – ${en}` }
      }
      if (b.hourly_rate !== a.hourly_rate) return { badge: 'Hourly rate', kind: 'violet', summary: arrow(b.hourly_rate, a.hourly_rate) }
      return { badge: 'Budget', kind: 'blue', summary: '' }
    }
  }
}

function fmtWhen(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

// ── One audit entry card + the list ─────────────────────────────────────────
function AuditRow({ entry, isOpen, onToggle }: { entry: AuditEntry; isOpen: boolean; onToggle: () => void }) {
  const c = describe(entry)
  const actor = entry.actorName ?? 'Someone'
  return (
    <div className="rounded-[12px] border border-slate-200 bg-white overflow-hidden">
      <button className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-subtle transition-colors" onClick={onToggle}>
        <span className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-tn-primary text-white font-(family-name:--font-display) font-extrabold text-[11px] mt-0.5">{initialsOf(actor)}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] leading-snug">
            <span className="font-(family-name:--font-display) font-extrabold text-tn-ink">{actor}</span>
            <span className="text-muted"> changed </span>
            {entry.entityLabel && <span className="font-(family-name:--font-display) font-extrabold text-tn-ink">{entry.entityLabel}</span>}
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`inline-flex items-center text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide rounded-[6px] px-2 py-0.5 ${PILL_CLASS[c.kind]}`}>{c.badge}</span>
            {c.summary && <span className="text-[12.5px] text-foreground tabular-nums">{c.summary}</span>}
          </div>
        </div>
        <span className="shrink-0 text-[11.5px] text-muted whitespace-nowrap mt-0.5">{fmtWhen(entry.changedAt)}</span>
        <svg className={`w-4 h-4 text-muted shrink-0 mt-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && entry.justification && (
        <div className="px-4 pb-4">
          <div className="rounded-[10px] border border-slate-200 bg-subtle p-4">
            <p className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted mb-2">Justification</p>
            <p className="text-[13px] text-foreground leading-relaxed whitespace-pre-line">{entry.justification}</p>
            <p className="text-[11.5px] text-muted mt-3">{actor} · {new Date(entry.changedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function AuditList({ entries }: { entries: AuditEntry[] }) {
  const [expanded, setExpanded] = useState<number | null>(null)
  return (
    <div className="space-y-3">
      {entries.map(e => (
        <AuditRow key={e.id} entry={e} isOpen={expanded === e.id} onToggle={() => setExpanded(expanded === e.id ? null : e.id)} />
      ))}
    </div>
  )
}

function AllHistoryModal({ entries, onClose }: { entries: AuditEntry[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(1,20,45,.44)] backdrop-blur-[2px] p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-[16px] bg-white shadow-[0_40px_90px_-30px_rgba(1,35,88,.6)]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-(family-name:--font-display) font-extrabold text-tn-ink">Change history · {entries.length}</h2>
          <button onClick={onClose} className="text-muted hover:text-tn-ink text-2xl leading-none">&times;</button>
        </div>
        <div className="p-5 overflow-y-auto"><AuditList entries={entries} /></div>
      </div>
    </div>
  )
}

/** The Change-history block (heading + recent list + "view more" modal). Used
 *  under the Clients tab and inside the top-level Change history section. */
export function ChangeHistory({ entries }: { entries: AuditEntry[] }) {
  const [showAll, setShowAll] = useState(false)
  const recent = entries.slice(0, RECENT_LIMIT)
  const hasMore = entries.length > RECENT_LIMIT

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="font-(family-name:--font-display) font-extrabold text-tn-ink">Change history</h3>
        {entries.length > 0 && <span className="text-[12.5px] text-muted">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>}
      </div>
      {entries.length === 0 ? (
        <div className="rounded-[12px] border border-slate-200 bg-white p-8 text-center space-y-2">
          <p className="text-sm font-medium text-tn-ink">No changes recorded yet</p>
          <p className="text-xs text-muted">Every budget and rate change will appear here with its justification.</p>
        </div>
      ) : (
        <>
          <AuditList entries={recent} />
          {hasMore && (
            <div className="flex justify-center pt-1">
              <button onClick={() => setShowAll(true)} className="text-[12.5px] font-(family-name:--font-display) font-extrabold px-4 py-2 rounded-[9px] border border-slate-200 text-foreground hover:border-tn-teal hover:text-tn-teal transition-colors">
                View more ({entries.length - RECENT_LIMIT} older)
              </button>
            </div>
          )}
        </>
      )}
      {showAll && <AllHistoryModal entries={entries} onClose={() => setShowAll(false)} />}
    </div>
  )
}

export function HistoryTab({ entries, pastBudgets, pastProjectHours }: Props) {
  return (
    <div className="space-y-8">
      <PastScheduleTables budgets={pastBudgets} hours={pastProjectHours} projects={I7_PROJECTS} />
      <ChangeHistory entries={entries} />
    </div>
  )
}
