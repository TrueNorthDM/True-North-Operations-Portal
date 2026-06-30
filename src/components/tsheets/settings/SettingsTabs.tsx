'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClientsTab } from './ClientsTab'
import { PeopleTab } from './PeopleTab'
import { HistoryTab } from './HistoryTab'
import { syncClientsFromPortal, syncPeopleFromPortal } from '@/lib/tsheets/settings-actions'
import type { ClientWithBudget } from './ClientsTab'
import type { PersonWithAssignments } from './PeopleTab'
import type { AuditEntry } from './HistoryTab'

type Tab = 'clients' | 'people' | 'history'

interface Props {
  clients: ClientWithBudget[]
  people: PersonWithAssignments[]
  auditLog: AuditEntry[]
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'clients', label: 'Clients & Budgets' },
  { key: 'people', label: 'People & Rates' },
  { key: 'history', label: 'Change History' },
]

export function SettingsTabs({ clients, people, auditLog }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('clients')
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [syncing, setSyncing] = useState<'clients' | 'people' | null>(null)

  async function handleSyncClients() {
    setSyncing('clients')
    setSyncMsg(null)
    const result = await syncClientsFromPortal()
    setSyncing(null)
    if (result.ok) {
      setSyncMsg(`Synced ${result.count} client${result.count !== 1 ? 's' : ''} from TSheets.`)
      router.refresh()
    } else {
      setSyncMsg(`Sync failed: ${result.error}`)
    }
  }

  async function handleSyncPeople() {
    setSyncing('people')
    setSyncMsg(null)
    const result = await syncPeopleFromPortal()
    setSyncing(null)
    if (result.ok) {
      setSyncMsg(`Linked ${result.linked}, imported ${result.imported} new people from TSheets.`)
      router.refresh()
    } else {
      setSyncMsg(`Sync failed: ${result.error}`)
    }
  }

  const allClients = clients.map(c => ({ id: c.id, name: c.name }))

  return (
    <div className="space-y-5">
      {/* Sync bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleSyncClients}
          disabled={syncing !== null}
          className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {syncing === 'clients' ? 'Syncing...' : 'Sync clients from TSheets'}
        </button>
        <button
          onClick={handleSyncPeople}
          disabled={syncing !== null}
          className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {syncing === 'people' ? 'Syncing...' : 'Sync people from TSheets'}
        </button>
        {syncMsg && (
          <span className="text-xs text-slate-600">{syncMsg}</span>
        )}
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
      {tab === 'clients' && <ClientsTab clients={clients} />}
      {tab === 'people' && <PeopleTab people={people} allClients={allClients} />}
      {tab === 'history' && <HistoryTab entries={auditLog} />}
    </div>
  )
}
