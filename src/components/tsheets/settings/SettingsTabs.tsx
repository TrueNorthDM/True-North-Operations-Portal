'use client'

import { useState } from 'react'
import { ClientsTab } from './ClientsTab'
import { PeopleTab } from './PeopleTab'
import { HistoryTab } from './HistoryTab'
import { SyncStatus } from './SyncStatus'
import type { ClientWithBudget } from './ClientsTab'
import type { PersonWithAssignments, DirectoryOption } from './PeopleTab'
import type { AuditEntry } from './HistoryTab'
import type { MonthlyBudget } from './MonthlyBudgetGrid'
import type { ProjectMonthHours } from './ProjectHoursGrid'

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
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'clients', label: 'Clients & Budgets' },
  { key: 'people', label: 'People & Rates' },
  { key: 'history', label: 'Change History' },
]

export function SettingsTabs({ clients, people, auditLog, directoryOptions, syncedAt, canSync, pastBudgets, pastProjectHours }: Props) {
  const [tab, setTab] = useState<Tab>('clients')

  const allClients = clients.map(c => ({ id: c.id, name: c.name }))

  return (
    <div className="space-y-5">
      {/* Sync status — the sync runs automatically every 4 hours (Vercel Cron). */}
      <SyncStatus syncedAt={syncedAt} interactive={canSync} />

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
      {tab === 'clients' && <ClientsTab clients={clients} />}
      {tab === 'people' && <PeopleTab people={people} allClients={allClients} directoryOptions={directoryOptions} />}
      {tab === 'history' && <HistoryTab entries={auditLog} pastBudgets={pastBudgets} pastProjectHours={pastProjectHours} />}
    </div>
  )
}
