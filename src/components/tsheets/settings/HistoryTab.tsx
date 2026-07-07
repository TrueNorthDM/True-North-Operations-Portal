'use client'

import { useState } from 'react'
import { I7_PROJECTS } from '@/lib/tsheets/i7report'
import { HistoricalScheduleModal } from './HistoricalScheduleModal'
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
}

interface Props {
  entries: AuditEntry[]
  pastBudgets: MonthlyBudget[]
  pastProjectHours: ProjectMonthHours[]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return m >= 1 && m <= 12 ? `${MONTHS[m - 1]} ${y}` : ym
}
function money(n: number | null | undefined): string {
  return n == null ? 'none' : '$' + Number(n).toLocaleString('en-US')
}

// ── Change type (the badge) ─────────────────────────────────────────────────
const TYPE_STYLES: Record<string, string> = {
  'Budget updated': 'bg-blue-50 text-blue-700 border-blue-200',
  'Extra budget': 'bg-amber-50 text-amber-700 border-amber-200',
  'Hourly rate updated': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Budget hours updated': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Budget history': 'bg-slate-100 text-slate-600 border-slate-200',
}

type MonthRow = { month: string; budget_amount: number | null; extra_amount: number | null }

function changeType(e: AuditEntry): string {
  switch (e.entityType) {
    case 'assignment': return 'Hourly rate updated'
    case 'project_budget': return 'Budget hours updated'
    case 'project_month_hours': return 'Budget hours updated'
    case 'budget_history': return 'Budget history'
    case 'monthly_budget': {
      const before = (e.beforeData?.months as MonthRow[]) ?? []
      const after = (e.afterData?.months as MonthRow[]) ?? []
      const bMap = new Map(before.map(m => [m.month, m.budget_amount]))
      const baseChanged = after.some(m => (bMap.get(m.month) ?? null) !== m.budget_amount)
      return baseChanged ? 'Budget updated' : 'Extra budget'
    }
    case 'budget': return 'Budget updated'
    default: return e.action
  }
}

function typeBadge(label: string) {
  const cls = TYPE_STYLES[label] ?? 'bg-slate-50 text-slate-600 border-slate-200'
  return <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${cls}`}>{label}</span>
}

// ── Change details (expanded) ───────────────────────────────────────────────
function monthlyDiff(e: AuditEntry): string[] {
  const before = (e.beforeData?.months as MonthRow[]) ?? []
  const after = (e.afterData?.months as MonthRow[]) ?? []
  const bMap = new Map(before.map(m => [m.month, m]))
  const fmt = (base: number | null | undefined, ex: number | null | undefined) => money(base) + (ex ? ` +${money(ex)}` : '')
  return after.map(a => {
    const bm = bMap.get(a.month)
    return `${monthLabel(a.month)}: ${fmt(bm?.budget_amount, bm?.extra_amount)} → ${fmt(a.budget_amount, a.extra_amount)}`
  })
}

type HourRow = { project: string; month: string; hours: number | null }
function projectHoursDiff(e: AuditEntry): string[] {
  const before = (e.beforeData?.hours as HourRow[]) ?? []
  const after = (e.afterData?.hours as HourRow[]) ?? []
  const bMap = new Map(before.map(h => [`${h.project}|${h.month}`, h.hours]))
  const fmt = (h: number | null | undefined) => (h ? `${h} h` : '—')
  return after.map(a => `${a.project} · ${monthLabel(a.month)}: ${fmt(bMap.get(`${a.project}|${a.month}`))} → ${fmt(a.hours)}`)
}

function genericDiff(entry: AuditEntry): string[] {
  const before = entry.beforeData
  const after = entry.afterData
  const lines: string[] = []
  const fields: { key: string; label: string; prefix?: string }[] = [
    { key: 'hourly_rate', label: 'Rate', prefix: '$' },
    { key: 'hours_allocated', label: 'Hours' },
    { key: 'budget_amount', label: 'Budget', prefix: '$' },
    { key: 'start_date', label: 'Budget start' },
    { key: 'budget_end_date', label: 'Budget end' },
    { key: 'extra_budget', label: 'Extra budget', prefix: '$' },
    { key: 'extra_start_date', label: 'Extra start' },
    { key: 'extra_end_date', label: 'Extra end' },
    { key: 'effective_from', label: 'Effective from' },
    { key: 'effective_to', label: 'Effective to' },
    { key: 'active', label: 'Active' },
  ]
  for (const f of fields) {
    const bv = before?.[f.key]
    const av = after[f.key]
    if (bv !== av) {
      const p = f.prefix ?? ''
      const fmt = (v: unknown) => (v == null ? 'none' : `${p}${v}`)
      lines.push(`${f.label}: ${fmt(bv)} → ${fmt(av)}`)
    }
  }
  return lines
}

function changeLines(entry: AuditEntry): string[] {
  if (entry.entityType === 'monthly_budget') return monthlyDiff(entry)
  if (entry.entityType === 'project_month_hours') return projectHoursDiff(entry)
  if (entry.entityType === 'budget_history') return []   // narrative-only seed
  return genericDiff(entry)
}

export function HistoryTab({ entries, pastBudgets, pastProjectHours }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const [showPast, setShowPast] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => setShowPast(true)}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          View past schedule
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center space-y-2">
          <p className="text-sm font-medium text-slate-700">No changes recorded yet</p>
          <p className="text-xs text-slate-500">Every budget and rate change will appear here with its justification.</p>
        </div>
      ) : (
      <div className="space-y-2">
      {entries.map(entry => {
        const lines = changeLines(entry)
        const isOpen = expanded === entry.id
        return (
          <div key={entry.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <button
              className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50"
              onClick={() => setExpanded(isOpen ? null : entry.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {typeBadge(changeType(entry))}
                  <span className="text-xs text-slate-400 truncate">{entry.justification}</span>
                </div>
              </div>
              <span className="shrink-0 text-xs text-slate-400">
                {new Date(entry.changedAt).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                })}
              </span>
              <svg
                className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isOpen && (
              <div className="border-t border-slate-100 px-5 py-4 space-y-3">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Justification</p>
                  <p className="text-sm text-slate-800 whitespace-pre-line">{entry.justification}</p>
                </div>
                {lines.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Changes</p>
                    <ul className="space-y-0.5">
                      {lines.map((line, i) => (
                        <li key={i} className="text-xs text-slate-700 flex gap-1.5">
                          <span className="text-slate-400">›</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-xs text-slate-400">
                  {new Date(entry.changedAt).toLocaleString('en-US')}
                </p>
              </div>
            )}
          </div>
        )
      })}
      </div>
      )}

      {showPast && (
        <HistoricalScheduleModal budgets={pastBudgets} hours={pastProjectHours} projects={I7_PROJECTS} onClose={() => setShowPast(false)} />
      )}
    </div>
  )
}
