'use client'

/**
 * TeamsManager — the Teams tab: one colour-coded card per team, showing its
 * members (with a LEAD pill for the team leader) and the projects it can reach.
 * Membership is edited on each person (Team field); grants on the Access tab.
 */

import { ROLE_PILL, ROLE_LABEL, type TeamKey } from './people-types'
import type { GrantRole } from '@/app/(app)/admin/teams/actions'

export interface TeamCardMember { id: string; name: string; initials: string; teamKey: TeamKey; isLead: boolean }
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

const TEAM_COLOR: Record<TeamKey, string> = { seo: '#1E7D7F', writing: '#e08a1e', web: '#6d5ae0', lead: '#012358', other: '#8593a4' }

export function TeamsManager({ cards }: { cards: TeamCard[] }) {
  if (cards.length === 0) {
    return (
      <div className="rounded-[16px] border border-dashed border-slate-300 bg-white/50 px-5 py-12 text-center text-sm text-muted">
        No teams yet.
      </div>
    )
  }

  return (
    <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))' }}>
      {cards.map(t => (
        <div key={t.id} className="border border-slate-200 bg-white rounded-[16px] overflow-hidden shadow-[0_1px_2px_rgba(1,35,88,.06)] flex flex-col">
          <div className="h-[5px]" style={{ background: t.color }} />
          <div className="px-[22px] pt-5 pb-[22px] flex-1 flex flex-col">
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <span className="w-[11px] h-[11px] rounded-[3px]" style={{ background: t.color }} />
                <h3 className="font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink m-0">{t.name}</h3>
              </div>
              <span className="font-(family-name:--font-display) font-extrabold text-[11px] text-muted">{t.memberCount} {t.memberCount === 1 ? 'member' : 'members'}</span>
            </div>

            <div className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-wider uppercase text-muted mt-[18px] mb-[9px]">Members</div>
            <div className="flex flex-col gap-0.5">
              {t.members.length === 0 && <span className="text-[12.5px] text-muted italic">No members yet.</span>}
              {t.members.map(m => (
                <div key={m.id} className="flex items-center gap-2.5 py-[5px]">
                  <span className="shrink-0 inline-flex items-center justify-center rounded-full text-white font-(family-name:--font-display) font-extrabold text-[10px]" style={{ width: 28, height: 28, background: TEAM_COLOR[m.teamKey] }}>{m.initials}</span>
                  <span className="text-[13.5px] text-foreground font-semibold">{m.name}</span>
                  {m.isLead && <span className="font-(family-name:--font-display) font-extrabold text-[9px] tracking-wide uppercase text-tn-teal bg-tn-teal-soft rounded-full px-2 py-0.5">Lead</span>}
                </div>
              ))}
            </div>

            <div className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-wider uppercase text-muted mt-[18px] mb-[9px]">Project access</div>
            <div className="flex flex-col gap-[7px]">
              {t.access.length === 0 && <span className="text-[12.5px] text-muted italic">No project access yet.</span>}
              {t.access.map(g => (
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
      ))}
    </div>
  )
}
