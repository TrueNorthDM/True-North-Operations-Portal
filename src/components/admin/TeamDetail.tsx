'use client'

/**
 * TeamDetail — the core "who can access what" screen. Left: team members
 * (add/remove). Right: project access grants (project + role). All edits go
 * through admin-guarded server actions; membership changes redraw the org chart.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  addTeamMember,
  removeTeamMember,
  setTeamGrant,
  removeTeamGrant,
  updateTeam,
  deleteTeam,
  type GrantRole,
} from '@/app/(app)/admin/teams/actions'

interface Named { id: string; name: string }
interface GrantedProject { projectId: string; name: string; role: GrantRole }

const ROLES: GrantRole[] = ['admin', 'member', 'viewer']
const ROLE_CLS: Record<GrantRole, string> = {
  admin: 'bg-indigo-100 text-indigo-700',
  member: 'bg-blue-100 text-blue-700',
  viewer: 'bg-slate-100 text-slate-600',
}

export function TeamDetail({
  team,
  leaderName,
  members,
  addablePeople,
  grantedProjects,
  availableProjects,
}: {
  team: Named
  leaderName: string | null
  members: Named[]
  addablePeople: Named[]
  grantedProjects: GrantedProject[]
  availableProjects: Named[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // add-member / add-grant local selections
  const [addPerson, setAddPerson] = useState('')
  const [addProject, setAddProject] = useState('')
  const [addRole, setAddRole] = useState<GrantRole>('viewer')
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState(team.name)
  const [confirmDel, setConfirmDel] = useState(false)

  function run(fn: () => Promise<void>, after?: () => void) {
    setError(null)
    startTransition(async () => {
      try { await fn(); after?.(); router.refresh() }
      catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong') }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <a href="/" className="hover:text-slate-800">Dashboard</a>
          <span>/</span>
          <a href="/admin" className="hover:text-slate-800">Admin</a>
          <span>/</span>
          <a href="/admin/teams" className="hover:text-slate-800">Teams</a>
          <span>/</span>
          <span>{team.name}</span>
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            {renaming ? (
              <div className="flex items-center gap-2">
                <input value={newName} onChange={e => setNewName(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-lg font-bold bg-white focus:outline-none focus:ring-2 focus:ring-slate-300" />
                <button type="button" disabled={pending || !newName.trim()} onClick={() => run(() => updateTeam(team.id, { name: newName }), () => setRenaming(false))} className="px-3 py-1.5 text-xs font-medium bg-slate-800 text-white rounded-lg disabled:opacity-50">Save</button>
                <button type="button" onClick={() => { setRenaming(false); setNewName(team.name) }} className="px-3 py-1.5 text-xs text-slate-500">Cancel</button>
              </div>
            ) : (
              <h1 className="text-2xl font-bold text-slate-900">
                {team.name}
                <button type="button" onClick={() => setRenaming(true)} className="ml-2 text-xs font-medium text-slate-400 hover:text-slate-600 align-middle">edit</button>
              </h1>
            )}
            <p className="mt-1 text-sm text-slate-500">{leaderName ? `Led by ${leaderName}` : 'No leader set'}</p>
          </div>
          {confirmDel ? (
            <span className="inline-flex items-center gap-2 text-sm">
              <span className="text-slate-500">Delete team?</span>
              <button type="button" disabled={pending} onClick={() => run(() => deleteTeam(team.id), () => router.push('/admin/teams'))} className="font-semibold text-red-600 hover:text-red-700 disabled:opacity-50">Yes</button>
              <button type="button" onClick={() => setConfirmDel(false)} className="text-slate-400 hover:text-slate-600">Cancel</button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmDel(true)} className="text-xs text-slate-400 hover:text-red-600">Delete team</button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Members */}
        <Panel title="Members" count={members.length}>
          <ul className="divide-y divide-slate-100">
            {members.map(m => (
              <li key={m.id} className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-800">{m.name}</span>
                <button type="button" disabled={pending} onClick={() => run(() => removeTeamMember(team.id, m.id))} className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-50">Remove</button>
              </li>
            ))}
            {members.length === 0 && <li className="py-3 text-sm text-slate-400">No members yet.</li>}
          </ul>
          <div className="mt-3 flex items-center gap-2">
            <select value={addPerson} onChange={e => setAddPerson(e.target.value)} className={selectCls}>
              <option value="">Add a person…</option>
              {addablePeople.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button type="button" disabled={pending || !addPerson} onClick={() => run(() => addTeamMember(team.id, addPerson), () => setAddPerson(''))} className="px-3 py-2 text-xs font-medium bg-slate-800 text-white rounded-lg disabled:opacity-50">Add</button>
          </div>
        </Panel>

        {/* Access */}
        <Panel title="Project access" count={grantedProjects.length}>
          <ul className="divide-y divide-slate-100">
            {grantedProjects.map(g => (
              <li key={g.projectId} className="flex items-center justify-between gap-2 py-2">
                <span className="text-sm text-slate-800">{g.name}</span>
                <div className="flex items-center gap-2">
                  <select
                    value={g.role}
                    disabled={pending}
                    onChange={e => run(() => setTeamGrant(team.id, g.projectId, e.target.value as GrantRole))}
                    className={`text-xs font-semibold rounded-full px-2.5 py-1 border-0 ${ROLE_CLS[g.role]} disabled:opacity-50`}
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <button type="button" disabled={pending} onClick={() => run(() => removeTeamGrant(team.id, g.projectId))} className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-50">Remove</button>
                </div>
              </li>
            ))}
            {grantedProjects.length === 0 && <li className="py-3 text-sm text-slate-400">No project access yet.</li>}
          </ul>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <select value={addProject} onChange={e => setAddProject(e.target.value)} className={selectCls}>
              <option value="">Grant a project…</option>
              {availableProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={addRole} onChange={e => setAddRole(e.target.value as GrantRole)} className={selectCls}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button type="button" disabled={pending || !addProject} onClick={() => run(() => setTeamGrant(team.id, addProject, addRole), () => setAddProject(''))} className="px-3 py-2 text-xs font-medium bg-slate-800 text-white rounded-lg disabled:opacity-50">Grant</button>
          </div>
        </Panel>
      </div>
    </div>
  )
}

const selectCls = 'rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300'

function Panel({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-baseline gap-2 mb-2">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        <span className="text-xs text-slate-400">{count}</span>
      </div>
      {children}
    </div>
  )
}
