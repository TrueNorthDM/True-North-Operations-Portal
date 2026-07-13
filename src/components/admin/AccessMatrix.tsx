'use client'

/**
 * AccessMatrix — the Access tab. Each row grants one team access to one project
 * with a role, editable inline. People inherit access from their teams. Writes
 * go through the team-grant actions; changing team/project moves the grant.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setTeamGrant, removeTeamGrant, type GrantRole } from '@/app/(app)/admin/teams/actions'
import type { TeamOption, ProjectOption } from './DirectoryTabs'

export interface AccessRow { id: string; teamId: string; projectId: string; role: GrantRole }

const ROLES: GrantRole[] = ['manager', 'publisher', 'editor', 'viewer']
const selectCls =
  'text-[13.5px] font-semibold text-tn-ink bg-white border border-slate-200 rounded-[9px] px-2.5 py-2 cursor-pointer max-w-full focus:outline-none focus:border-tn-teal'

interface Row extends AccessRow { uid: string }

export function AccessMatrix({ rows, teamOptions, projectOptions }: { rows: AccessRow[]; teamOptions: TeamOption[]; projectOptions: ProjectOption[] }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [local, setLocal] = useState<Row[]>(() => rows.map(r => ({ ...r, uid: r.id })))
  const [error, setError] = useState<string | null>(null)

  // Re-sync when the server data changes (after a refresh) — the during-render
  // "adjust state on prop change" pattern, so optimistic edits survive until the
  // next refresh but server truth wins once it arrives.
  const [prevRows, setPrevRows] = useState(rows)
  if (rows !== prevRows) {
    setPrevRows(rows)
    setLocal(rows.map(r => ({ ...r, uid: r.id })))
  }

  const colorByTeam = new Map(teamOptions.map(t => [t.id, t.color]))
  const logoByProject = new Map(projectOptions.map(p => [p.id, p.logo]))

  function run(fn: () => Promise<void>) {
    setError(null)
    startTransition(async () => {
      try {
        await fn()
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not update access')
        router.refresh()
      }
    })
  }

  function changeTeam(row: Row, teamId: string) {
    setLocal(l => l.map(r => (r.uid === row.uid ? { ...r, teamId } : r)))
    run(async () => {
      await removeTeamGrant(row.teamId, row.projectId)
      await setTeamGrant(teamId, row.projectId, row.role)
    })
  }
  function changeProject(row: Row, projectId: string) {
    setLocal(l => l.map(r => (r.uid === row.uid ? { ...r, projectId } : r)))
    run(async () => {
      await removeTeamGrant(row.teamId, row.projectId)
      await setTeamGrant(row.teamId, projectId, row.role)
    })
  }
  function changeRole(row: Row, role: GrantRole) {
    setLocal(l => l.map(r => (r.uid === row.uid ? { ...r, role } : r)))
    run(() => setTeamGrant(row.teamId, row.projectId, role))
  }
  function revoke(row: Row) {
    setLocal(l => l.filter(r => r.uid !== row.uid))
    run(() => removeTeamGrant(row.teamId, row.projectId))
  }
  function addGrant() {
    const team = teamOptions[0]
    const project = projectOptions[0]
    if (!team || !project) return
    setLocal(l => [...l, { uid: `new-${Date.now()}`, id: `${team.id}|${project.id}`, teamId: team.id, projectId: project.id, role: 'editor' }])
    run(() => setTeamGrant(team.id, project.id, 'editor'))
  }

  const canAdd = teamOptions.length > 0 && projectOptions.length > 0

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-[18px]">
        <p className="text-[13.5px] text-muted max-w-[560px] leading-relaxed">
          Each row grants one <b className="text-foreground font-bold">team</b> access to one <b className="text-foreground font-bold">project</b> with a role. People inherit access from the teams they belong to.
        </p>
        <button
          type="button"
          onClick={addGrant}
          disabled={!canAdd}
          className="inline-flex items-center gap-[7px] font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink bg-white border border-slate-200 rounded-[10px] px-[15px] py-[9px] transition-all hover:border-tn-teal hover:text-tn-teal disabled:opacity-50"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Grant access
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <div className="border border-slate-200 bg-white rounded-[16px] overflow-hidden shadow-[0_1px_2px_rgba(1,35,88,.06)]">
        <div className="grid grid-cols-[1.2fr_1.6fr_1fr_.6fr] gap-3.5 items-center px-[22px] py-[13px] bg-subtle border-b border-slate-200">
          {['Team', 'Project', 'Role', ''].map((h, i) => (
            <span key={i} className={`font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-wide uppercase text-muted ${i === 3 ? 'text-right' : ''}`}>{h}</span>
          ))}
        </div>

        {local.map((row, i) => (
          <div key={row.uid} className={`grid grid-cols-[1.2fr_1.6fr_1fr_.6fr] gap-3.5 items-center px-[22px] py-3 ${i === 0 ? '' : 'border-t border-slate-200'}`}>
            <span className="inline-flex items-center gap-2.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: colorByTeam.get(row.teamId) ?? '#8593a4' }} />
              <select value={row.teamId} onChange={e => changeTeam(row, e.target.value)} className={selectCls}>
                {teamOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </span>
            <span className="inline-flex items-center gap-2.5 min-w-0">
              {logoByProject.get(row.projectId) && <img src={logoByProject.get(row.projectId) as string} alt="" className="w-6 h-6 rounded-md object-cover shrink-0" />}
              <select value={row.projectId} onChange={e => changeProject(row, e.target.value)} className={selectCls}>
                {projectOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </span>
            <span>
              <select value={row.role} onChange={e => changeRole(row, e.target.value as GrantRole)} className={`${selectCls} font-(family-name:--font-display) font-extrabold capitalize`}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </span>
            <span className="inline-flex justify-end">
              <button type="button" onClick={() => revoke(row)} title="Revoke" className="inline-flex w-8 h-8 items-center justify-center rounded-[9px] border border-slate-200 bg-white text-muted transition-all hover:border-red-500 hover:text-red-500">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
              </button>
            </span>
          </div>
        ))}

        {local.length === 0 && (
          <div className="px-[22px] py-[52px] text-center"><p className="text-sm text-muted">No access granted yet. Use “Grant access” to add the first one.</p></div>
        )}
      </div>
    </div>
  )
}
