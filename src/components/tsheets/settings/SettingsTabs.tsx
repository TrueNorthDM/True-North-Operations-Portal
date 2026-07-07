'use client'

import { useState } from 'react'
import { ClientsTab } from './ClientsTab'
import { PeopleTab } from './PeopleTab'
import { HistoryTab } from './HistoryTab'
import { SyncStatus } from './SyncStatus'
import { TargetsEditor } from '@/components/boards/TargetsEditor'
import type { ClientWithBudget } from './ClientsTab'
import type { PersonWithAssignments, DirectoryOption } from './PeopleTab'
import type { AuditEntry } from './HistoryTab'
import type { MonthlyBudget } from './MonthlyBudgetGrid'
import type { ProjectMonthHours } from './ProjectHoursGrid'
import type { PublishingTargetRow, AuditLogRow } from '@/lib/types/database.types'

type Tab = 'clients' | 'people' | 'history'

interface Props {
  clients: ClientWithBudget[]
  people: PersonWithAssignments[]
  auditLog: AuditEntry[]
  directoryOptions: DirectoryOption[]
  syncedAt: string | null
  canSync: boolean
  pastBudgets: MonthlyBudget[]
  pastProjectHours: ProjectMonthHours[]
  publishingTargets: PublishingTargetRow[]
  publishingAudit: AuditLogRow[]
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'clients', label: 'Clients & Budgets' },
  { key: 'people', label: 'People & Rates' },
  { key: 'history', label: 'Change History' },
]

export function SettingsTabs({ clients, people, auditLog, directoryOptions, syncedAt, canSync, pastBudgets, pastProjectHours, publishingTargets, publishingAudit }: Props) {
  const [tab, setTab] = useState<Tab>('clients')

  const allClients = clients.map(c => ({ id: c.id, name: c.name }))

  return (
    <div className="space-y-5">
      {/* Sync status — the sync runs automatically every 4 hours (Vercel Cron).
          The info icon opens the plain-language "how the report works" guide. */}
      <div className="flex items-center gap-2">
        <a
          href="/tools/time-report/guide"
          aria-label="How the report works"
          title="How the report works"
          className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-900 text-white hover:bg-slate-800 shrink-0"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
            <circle cx="12" cy="7.2" r="1.5" />
            <rect x="10.6" y="10.4" width="2.8" height="7.4" rx="1.4" />
          </svg>
        </a>
        <SyncStatus syncedAt={syncedAt} interactive={canSync} />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'clients' && (
        <div className="space-y-8">
          <ClientsTab clients={clients} />
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-1">Publishing targets</h2>
            <p className="text-xs text-slate-400 mb-3">
              Weekly pages-published goals per board &amp; language. The Boards Review dashboard tracks progress against these.
            </p>
            <TargetsEditor targets={publishingTargets} isAdmin={canSync} audit={publishingAudit} grid />
          </div>
        </div>
      )}
      {tab === 'people' && <PeopleTab people={people} allClients={allClients} directoryOptions={directoryOptions} />}
      {tab === 'history' && <HistoryTab entries={auditLog} pastBudgets={pastBudgets} pastProjectHours={pastProjectHours} />}
    </div>
  )
}
