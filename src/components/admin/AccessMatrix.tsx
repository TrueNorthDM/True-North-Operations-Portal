'use client'

/**
 * AccessMatrix — Teams (rows) × Projects (columns). Each cell is the team's
 * role on that project, editable inline: changing the dropdown writes the grant
 * (or removes it on "None"). The fast, auditable surface for "who can access
 * what". Reuses the team-grant actions.
 */

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setTeamGrant, removeTeamGrant, type GrantRole } from '@/app/(app)/admin/teams/actions'

interface Named { id: string; name: string }
export interface AccessCell { teamId: string; projectId: string; role: GrantRole }

const ROLES: GrantRole[] = ['admin', 'member', 'viewer']
const ROLE_CLS: Record<GrantRole, string> = {
  admin: 'bg-indigo-100 text-indigo-700',
  member: 'bg-blue-100 text-blue-700',
  viewer: 'bg-slate-100 text-slate-600',
}

export function AccessMatrix({
  teams,
  projects,
  cells,
  embedded = false,
}: {
  teams: Named[]
  projects: Named[]
  cells: AccessCell[]
  embedded?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const roleOf = new Map(cells.map(c => [`${c.teamId}|${c.projectId}`, c.role]))

  function change(teamId: string, projectId: string, value: string) {
    const key = `${teamId}|${projectId}`
    setError(null)
    setBusyKey(key)
    startTransition(async () => {
      try {
        if (value === 'none') await removeTeamGrant(teamId, projectId)
        else await setTeamGrant(teamId, projectId, value as GrantRole)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not update access')
      } finally {
        setBusyKey(null)
      }
    })
  }

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/" className="hover:text-slate-800">Dashboard</Link>
            <span>/</span>
            <Link href="/admin" className="hover:text-slate-800">Admin</Link>
            <span>/</span>
            <span>Access</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Access</h1>
          <p className="mt-1 text-sm text-slate-500">Which teams can reach which projects. Change a cell to edit the grant.</p>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {teams.length === 0 || projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white/50 px-5 py-10 text-center text-sm text-slate-400">
          {teams.length === 0 ? 'No teams yet — create one in Teams.' : 'No projects yet.'}
        </div>
      ) : (
        <div className="rounded-xl bg-white border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 px-4 py-3 sticky left-0 bg-slate-50">Team</th>
                {projects.map(p => (
                  <th key={p.id} className="text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 px-4 py-3 min-w-[140px]">{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teams.map(t => (
                <tr key={t.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-800 sticky left-0 bg-white">{t.name}</td>
                  {projects.map(p => {
                    const key = `${t.id}|${p.id}`
                    const role = roleOf.get(key) ?? null
                    return (
                      <td key={p.id} className="px-4 py-3 text-center">
                        <select
                          value={role ?? 'none'}
                          disabled={pending && busyKey === key}
                          onChange={e => change(t.id, p.id, e.target.value)}
                          className={`text-xs font-semibold rounded-full px-2.5 py-1 border-0 cursor-pointer disabled:opacity-50 ${role ? ROLE_CLS[role] : 'bg-slate-50 text-slate-400'}`}
                        >
                          <option value="none">— none —</option>
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Showing team grants. Need per-person exceptions or a team’s members? Open the <strong>Teams</strong> tab.
      </p>
    </div>
  )
}
