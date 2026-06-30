'use client'

import { useState } from 'react'

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
}

function actionBadge(action: string) {
  const styles: Record<string, string> = {
    create: 'bg-green-50 text-green-700 border-green-200',
    update: 'bg-blue-50 text-blue-700 border-blue-200',
    deactivate: 'bg-red-50 text-red-700 border-red-200',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${styles[action] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
      {action}
    </span>
  )
}

function dateDiff(entry: AuditEntry): string[] {
  const before = entry.beforeData
  const after = entry.afterData
  const lines: string[] = []

  const fields: { key: string; label: string; prefix?: string }[] = [
    { key: 'hourly_rate', label: 'Rate', prefix: '$' },
    { key: 'hours_allocated', label: 'Hours' },
    { key: 'budget_amount', label: 'Budget', prefix: '$' },
    { key: 'extra_budget', label: 'Extra budget', prefix: '$' },
    { key: 'start_date', label: 'Start date' },
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

export function HistoryTab({ entries }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null)

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center space-y-2">
        <p className="text-sm font-medium text-slate-700">No changes recorded yet</p>
        <p className="text-xs text-slate-500">Every budget and rate change will appear here with its justification.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {entries.map(entry => {
        const diff = dateDiff(entry)
        const isOpen = expanded === entry.id
        return (
          <div key={entry.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <button
              className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50"
              onClick={() => setExpanded(isOpen ? null : entry.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {actionBadge(entry.action)}
                  <span className="text-xs font-medium text-slate-700">{entry.entityType}</span>
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
                  <p className="text-sm text-slate-800">{entry.justification}</p>
                </div>
                {diff.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Changes</p>
                    <ul className="space-y-0.5">
                      {diff.map((line, i) => (
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
  )
}
