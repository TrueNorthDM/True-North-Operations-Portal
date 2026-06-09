'use client'

/** TeamsList — admin team roster. Add a team; open one to manage members + access. */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createTeam } from '@/app/(app)/admin/teams/actions'

export interface TeamView {
  id: string
  name: string
  leaderName: string | null
  memberCount: number
  projects: { name: string; role: string }[]
}

const ROLE_CLS: Record<string, string> = {
  admin: 'bg-indigo-100 text-indigo-700',
  member: 'bg-blue-100 text-blue-700',
  viewer: 'bg-slate-100 text-slate-600',
}

export function TeamsList({ teams }: { teams: TeamView[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <a href="/" className="hover:text-slate-800">Dashboard</a>
          <span>/</span>
          <a href="/admin" className="hover:text-slate-800">Admin</a>
          <span>/</span>
          <span>Teams</span>
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Teams</h1>
            <p className="mt-1 text-sm text-slate-500">Group people and grant each team access to projects.</p>
          </div>
          <button
            type="button"
            onClick={() => { setAdding(a => !a); setError(null) }}
            className="shrink-0 px-4 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors"
          >
            + Add team
          </button>
        </div>
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
            <a key={t.id} href={`/admin/teams/${t.id}`} className="group rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:shadow-md transition-all">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-bold text-slate-900 group-hover:text-slate-700">{t.name}</h2>
                <span className="text-xs text-slate-400">{t.memberCount} {t.memberCount === 1 ? 'member' : 'members'}</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{t.leaderName ? `Led by ${t.leaderName}` : 'No leader set'}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {t.projects.length === 0
                  ? <span className="text-xs text-slate-300">No project access</span>
                  : t.projects.map(p => (
                      <span key={p.name} className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_CLS[p.role] ?? 'bg-slate-100 text-slate-600'}`}>
                        {p.name} · {p.role}
                      </span>
                    ))}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
