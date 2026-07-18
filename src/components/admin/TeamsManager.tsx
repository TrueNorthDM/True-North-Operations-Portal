'use client'

/**
 * TeamsManager — the Teams tab. Admins create, rename and delete teams, set the
 * team lead, and add/remove members here. Each card lists members with the team
 * lead (then anyone typed Team Leader) at the top and users below alphabetically,
 * each showing their contact-type. Project access is still edited on the Access
 * tab; per-team tool access is edited here (Phase B).
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createTeam, updateTeam, deleteTeam, addTeamMember, removeTeamMember } from '@/app/(app)/admin/teams/actions'
import type { GrantRole } from '@/app/(app)/admin/teams/actions'
import { Avatar } from '@/components/Avatar'
import { ROLE_PILL, ROLE_LABEL, roleTypePill, PILL_CLASS, TEAM_COLOR, type PersonView, type TeamKey } from './people-types'

export interface TeamCardMember { id: string; name: string; initials: string; teamKey: TeamKey; isLead: boolean; roleType: string; avatarUrl: string | null }
export interface TeamCardAccess { projectId: string; name: string; logo: string | null; role: GrantRole }
export interface TeamCard {
  id: string
  name: string
  teamKey: TeamKey
  color: string
  memberCount: number
  members: TeamCardMember[]
  access: TeamCardAccess[]
}

export function TeamsManager({ cards, people }: { cards: TeamCard[]; people: PersonView[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run(fn: () => Promise<void>) {
    setError(null)
    startTransition(async () => {
      try { await fn(); router.refresh() }
      catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); router.refresh() }
    })
  }

  function onNewTeam() {
    const name = window.prompt('New team name')
    if (name && name.trim()) run(() => createTeam(name.trim()))
  }
  function onRename(t: TeamCard) {
    const name = window.prompt('Rename team', t.name)
    if (name && name.trim() && name.trim() !== t.name) run(() => updateTeam(t.id, { name: name.trim() }))
  }
  function onDelete(t: TeamCard) {
    if (window.confirm(`Delete the team “${t.name}”? Members stay in the directory; only the team and its access are removed.`)) run(() => deleteTeam(t.id))
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-[18px]">
        <p className="text-[13.5px] text-muted max-w-[560px] leading-relaxed">
          Create teams, set a lead, and add members. Team membership also shows on each person’s card (Team field). Project access is on the <b className="text-foreground font-bold">Access</b> tab.
        </p>
        <button type="button" onClick={onNewTeam} disabled={pending}
          className="inline-flex items-center gap-[7px] font-(family-name:--font-display) font-extrabold text-[13px] text-white bg-tn-primary rounded-[10px] px-[15px] py-[9px] shadow-[0_10px_24px_-12px_rgba(1,35,88,.7)] transition-all hover:brightness-110 disabled:opacity-50">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          <span className="text-[#ffffff]">New team</span>
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {cards.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-slate-300 bg-white/50 px-5 py-12 text-center text-sm text-muted">No teams yet — create the first one.</div>
      ) : (
        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(360px,1fr))' }}>
          {cards.map(t => (
            <TeamCardView key={t.id} team={t} people={people} pending={pending} run={run} onRename={() => onRename(t)} onDelete={() => onDelete(t)} />
          ))}
        </div>
      )}
    </div>
  )
}

function TeamCardView({ team, people, pending, run, onRename, onDelete }: {
  team: TeamCard
  people: PersonView[]
  pending: boolean
  run: (fn: () => Promise<void>) => void
  onRename: () => void
  onDelete: () => void
}) {
  const memberIds = new Set(team.members.map(m => m.id))
  const addable = people.filter(p => !memberIds.has(p.id)).sort((a, b) => a.full_name.localeCompare(b.full_name))

  return (
    <div className="border border-slate-200 bg-white rounded-[16px] overflow-hidden shadow-[0_1px_2px_rgba(1,35,88,.06)] flex flex-col">
      <div className="h-[5px]" style={{ background: team.color }} />
      <div className="px-[22px] pt-5 pb-[22px] flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-[11px] h-[11px] rounded-[3px] shrink-0" style={{ background: team.color }} />
            <h3 className="font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink m-0 truncate">{team.name}</h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={onRename} disabled={pending} aria-label="Rename team" className="inline-flex w-8 h-8 items-center justify-center rounded-[9px] text-muted transition-colors hover:bg-subtle hover:text-tn-ink disabled:opacity-50">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
            </button>
            <button type="button" onClick={onDelete} disabled={pending} aria-label="Delete team" className="inline-flex w-8 h-8 items-center justify-center rounded-[9px] text-muted transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
            </button>
          </div>
        </div>

        <div className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-wider uppercase text-muted mt-[18px] mb-2">Members · {team.memberCount}</div>
        <div className="flex flex-col gap-0.5">
          {team.members.length === 0 && <span className="text-[12.5px] text-muted italic">No members yet.</span>}
          {team.members.map(m => {
            const pill = roleTypePill(m.roleType)
            return (
              <div key={m.id} className="group/mem flex items-center gap-2.5 py-[5px]">
                <Avatar name={m.name} avatarUrl={m.avatarUrl} size={28} color={TEAM_COLOR[m.teamKey]} />
                <span className="text-[13.5px] text-foreground font-semibold truncate min-w-0">{m.name}</span>
                {m.isLead && <span className="font-(family-name:--font-display) font-extrabold text-[9px] tracking-wide uppercase text-tn-teal bg-tn-teal-soft rounded-full px-2 py-0.5 shrink-0">Lead</span>}
                <span className={`font-(family-name:--font-display) font-extrabold text-[9px] tracking-wide uppercase rounded-full px-2 py-0.5 shrink-0 ${PILL_CLASS[pill.kind]}`}>{pill.label}</span>
                <span className="ml-auto flex items-center gap-1 opacity-0 group-hover/mem:opacity-100 transition-opacity">
                  {!m.isLead && (
                    <button type="button" title="Make lead" disabled={pending} onClick={() => run(() => updateTeam(team.id, { leader_person_id: m.id }))} className="inline-flex w-7 h-7 items-center justify-center rounded-[8px] text-muted hover:bg-tn-teal-soft hover:text-tn-teal disabled:opacity-50">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                    </button>
                  )}
                  <button type="button" title="Remove from team" disabled={pending} onClick={() => run(() => removeTeamMember(team.id, m.id))} className="inline-flex w-7 h-7 items-center justify-center rounded-[8px] text-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                </span>
              </div>
            )
          })}
        </div>

        {addable.length > 0 && (
          <select
            value=""
            disabled={pending}
            onChange={e => { const id = e.target.value; if (id) run(() => addTeamMember(team.id, id)) }}
            className="mt-3 text-[13px] font-semibold text-tn-teal bg-white border border-dashed border-slate-300 rounded-[10px] px-3 py-2.5 cursor-pointer hover:border-tn-teal focus:outline-none focus:border-tn-teal disabled:opacity-50"
          >
            <option value="">+ Add member…</option>
            {addable.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        )}

        <div className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-wider uppercase text-muted mt-[18px] mb-[9px]">Project access</div>
        <div className="flex flex-col gap-[7px]">
          {team.access.length === 0 && <span className="text-[12.5px] text-muted italic">No project access yet — set it on the Access tab.</span>}
          {team.access.map(g => (
            <div key={g.projectId} className="flex items-center justify-between gap-2.5 border border-slate-200 rounded-[10px] px-[11px] py-[7px]">
              <span className="inline-flex items-center gap-2.5 min-w-0">
                {g.logo && <img src={g.logo} alt="" className="w-[22px] h-[22px] rounded-md object-cover shrink-0" />}
                <span className="text-[12.5px] font-semibold text-foreground truncate">{g.name}</span>
              </span>
              <span className={`font-(family-name:--font-display) font-extrabold text-[10px] tracking-wide uppercase rounded-full px-[11px] py-1 whitespace-nowrap ${ROLE_PILL[g.role] ?? ROLE_PILL.viewer}`}>{ROLE_LABEL[g.role] ?? g.role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
