'use client'

/**
 * DirectoryTabs — the single admin surface for the org: People, Teams, and
 * Access, all controlled from one page. Each tab renders its existing manager
 * component in "embedded" mode (no per-component page chrome).
 */

import { useState } from 'react'
import { PeopleManager, type PersonView } from './PeopleManager'
import { TeamsManager, type TeamManagerTeam } from './TeamsManager'
import { AccessMatrix, type AccessCell } from './AccessMatrix'

type Tab = 'people' | 'teams' | 'access'

const TABS: { key: Tab; label: string }[] = [
  { key: 'people', label: 'People' },
  { key: 'teams', label: 'Teams' },
  { key: 'access', label: 'Access' },
]

interface Named { id: string; name: string }

export function DirectoryTabs({
  people,
  availableAccounts,
  teams,
  accessTeams,
  accessProjects,
  accessCells,
}: {
  people: PersonView[]
  availableAccounts: { id: string; email: string }[]
  teams: TeamManagerTeam[]
  accessTeams: Named[]
  accessProjects: Named[]
  accessCells: AccessCell[]
}) {
  const [tab, setTab] = useState<Tab>('people')

  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'people' && <PeopleManager embedded people={people} availableAccounts={availableAccounts} />}
      {tab === 'teams' && <TeamsManager teams={teams} />}
      {tab === 'access' && <AccessMatrix embedded teams={accessTeams} projects={accessProjects} cells={accessCells} />}
    </div>
  )
}
