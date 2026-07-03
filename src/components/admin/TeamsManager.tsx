'use client'

/**
 * TeamsManager — the Teams tab of the unified directory. Lists teams; selecting
 * one opens its member + access management inline (TeamDetail, embedded) without
 * leaving the page. Reuses the same team/membership/grant server actions.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createTeam, type GrantRole } from '@/app/(app)/admin/teams/actions'
import { TeamDetail } from './TeamDetail'

interface Named { id: string; name: string }
interface GrantedProject { projectId: string; name: string; role: GrantRole }

export interface TeamManagerTeam {
  id: string
  name: string
  leaderName: string | null
  members: Named[]
  addablePeople: Named[]
  grantedProjects: GrantedProject[]
  availableProjects: Named[]
}

const ROLE_CLS: Record<string, string> = {
  admin: 'bg-indigo-100 text-indigo-700',
  member: 'bg-blue-100 text-blue-700',
  viewer: 'bg-slate-100 text-slate-600',
}

export function TeamsManager({ teams }: { teams: TeamManagerTeam[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const selectedTeam = teams.find(t => t.id === selected) ?? null

  function add() {
    setError(null)
    startTransition(async () => {
      try {
        await createTeam(name)
        setName('')
        setAdding(false)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not create team')
      }
    })
  }

  // Selected → manage this team inline.
  if (selectedTeam) {
    return (
      <TeamDetail
        key={selectedTeam.id}
        embedded
        team={{ id: selectedTeam.id, name: selectedTeam.name }}
        leaderName={selectedTeam.leaderName}
        members={selectedTeam.members}
        addablePeople={selectedTeam.addablePeople}
        grantedProjects={selectedTeam.grantedProjects}
        availableProjects={selectedTeam.availableProjects}
        onBack={() => setSelected(null)}
        onDeleted={() => setSelected(null)}
      />
    )
  }

  // Otherwise → the team roster.
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-slate-500">Group people into teams, then grant each team access to projects.</p>
        <button
          type="button"
          onClick={() => { setAdding(a => !a); setError(null) }}
          className="shrink-0 px-4 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors"
        >
          + Add team
        </button>
      </div>

      {adding && (
        <div className="rounded-xl border border-slate-300 bg-white p-4 flex items-center gap-2 flex-wrap">
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && name.trim()) add() }}
            placeholder="Team name (e.g. Writers)"
            className="flex-1 min-w-[200px] rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
          <button type="button" disabled={pending || !name.trim()} onClick={add} className="px-4 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-900 text-white rounded-lg disabled:opacity-50">
            {pending ? 'Adding…' : 'Add'}
          </button>
          <button type="button" onClick={() => { setAdding(false); setName('') }} className="px-3 py-2 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
          {error && <p className="w-full text-sm text-red-600">{error}</p>}
        </div>
      )}

      {teams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/50 px-5 py-10 text-center text-sm text-slate-400">
          No teams yet — add one to start granting access.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teams.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelected(t.id)}
              className="group text-left rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-bold text-slate-900 group-hover:text-slate-700">{t.name}</h2>
                <span className="text-xs text-slate-400">{t.members.length} {t.members.length === 1 ? 'member' : 'members'}</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{t.leaderName ? `Led by ${t.leaderName}` : 'No leader set'}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {t.grantedProjects.length === 0
                  ? <span className="text-xs text-slate-300">No project access</span>
                  : t.grantedProjects.map(p => (
                      <span key={p.projectId} className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_CLS[p.role] ?? 'bg-slate-100 text-slate-600'}`}>
                        {p.name} · {p.role}
                      </span>
                    ))}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
