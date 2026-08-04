'use client'

/**
 * TeamsManager: the Teams tab. Admins create, rename and delete teams, set the
 * team lead, and add/remove members here. Each card lists members with the team
 * lead (then anyone typed Team Leader) at the top and users below alphabetically,
 * each showing their contact-type. The full explanation of what each contact
 * type can see/do lives on Admin → Access levels (this tab only links to it);
 * per-team tool access is set on each card.
 */

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createTeam, updateTeam, deleteTeam, addTeamMember, removeTeamMember, setTeamMemberPosition, setTeamTool, removeTeamTool } from '@/app/(app)/admin/teams/actions'
import type { GrantRole } from '@/app/(app)/admin/teams/actions'
import { Avatar } from '@/components/Avatar'
import { roleTypePill, teamPositionPill, PILL_CLASS, TEAM_COLOR, type PersonView, type TeamKey } from '@/lib/directory/people-types'
import { TOOLS, type ToolAudience } from '@/lib/access/tools'
import { COLOR_PALETTE, DEFAULT_COLOR, textColorFor } from '@/lib/constants/color-palette'
import { Select } from '@/components/ui/Select'

export interface TeamCardMember { id: string; name: string; initials: string; teamKey: TeamKey; isLead: boolean; position: string; roleType: string; avatarUrl: string | null }
export interface TeamCardAccess { projectId: string; name: string; logo: string | null; role: GrantRole }
export interface TeamCardTool { toolKey: string; audience: ToolAudience }
export interface TeamCard {
  id: string
  name: string
  teamKey: TeamKey
  color: string
  memberCount: number
  members: TeamCardMember[]
  access: TeamCardAccess[]
  tools: TeamCardTool[]
}

// The create/rename dialog is either creating a new team or editing an existing
// one (name + colour). null = closed.
type DialogState = { mode: 'new' } | { mode: 'edit'; team: TeamCard } | null

export function TeamsManager({ cards, people }: { cards: TeamCard[]; people: PersonView[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // The create/rename dialog (styled, replaces the native window.prompt).
  const [dialog, setDialog] = useState<DialogState>(null)

  function run(fn: () => Promise<void>) {
    setError(null)
    startTransition(async () => {
      try { await fn(); router.refresh() }
      catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); router.refresh() }
    })
  }

  function onDialogSave(name: string, color: string) {
    const d = dialog
    if (!d) return
    if (d.mode === 'new') {
      run(() => createTeam(name, color))
    } else {
      // Only send the fields that actually changed.
      const patch: { name?: string; color?: string } = {}
      if (name !== d.team.name) patch.name = name
      if (color !== d.team.color) patch.color = color
      if (Object.keys(patch).length) run(() => updateTeam(d.team.id, patch))
    }
    setDialog(null)
  }
  function onDelete(t: TeamCard) {
    if (window.confirm(`Delete the team “${t.name}”? Members stay in the directory; only the team and its access are removed.`)) run(() => deleteTeam(t.id))
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-[18px]">
        <p className="text-[13.5px] text-muted leading-relaxed">
          Create teams and add members. Each member has a <b className="text-foreground font-semibold">Team Position</b> here (Team Leader or Collaborator), separate from their <b className="text-foreground font-semibold">Contact type</b> (portal access). A person can be in several teams with a different position in each.
        </p>
        <button type="button" onClick={() => setDialog({ mode: 'new' })} disabled={pending}
          className="inline-flex items-center gap-[7px] font-(family-name:--font-display) font-extrabold text-[13px] text-white bg-tn-primary rounded-[10px] px-[15px] py-[9px] shadow-[0_10px_24px_-12px_rgba(1,35,88,.7)] transition-all hover:brightness-110 disabled:opacity-50">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          <span className="text-[#ffffff]">New team</span>
        </button>
      </div>

      {/* Short pointer, the full access reference lives on Admin → Access levels
          so this tab can stay about teams. */}
      <div className="rounded-[16px] border border-slate-200 bg-white p-5 mb-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink mb-0.5">Team Position is not portal access</div>
            <p className="text-[12.5px] text-muted leading-relaxed m-0">
              The pills on the member cards below (Founder, Manager, Team&nbsp;Leader, Collaborator) say what someone does
              <b className="text-foreground font-semibold"> inside this team</b>. What they can open in the portal is their
              <b className="text-foreground font-semibold"> contact type</b>, set per person and explained in full on the Access levels page.
            </p>
          </div>
          <Link
            href="/admin/access-levels"
            className="shrink-0 inline-flex items-center gap-2 rounded-full px-[15px] py-2 font-(family-name:--font-display) font-extrabold text-[12px] border border-slate-200 text-foreground hover:border-tn-teal hover:text-tn-teal transition-colors"
          >
            Access levels
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
          </Link>
        </div>
        <div className="pt-4 border-t border-slate-100">
          <div className="font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink mb-1.5">How tool access works</div>
          <p className="text-[12.5px] text-muted leading-relaxed m-0">
            On each team card below, set who can open each tool, <b className="text-foreground font-semibold">Off</b> (hidden), <b className="text-foreground font-semibold">Lead only</b> (just the team lead), or <b className="text-foreground font-semibold">Whole team</b>.{' '}
            A tool is only reachable if the person’s <b className="text-foreground font-semibold">level</b> allows Tools <i>and</i> one of their teams grants it, so a tool left <b className="text-foreground font-semibold">Off</b> everywhere is hidden from everyone except admins.
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {cards.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-slate-300 bg-white/50 px-5 py-12 text-center text-sm text-muted">No teams yet, create the first one.</div>
      ) : (
        // At most 4 across (wider cards); steps down for tablet → mobile:
        // 1 col on phones, 2 on tablets, 3 on desktops, 4 only on wide screens.
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {cards.map(t => (
            <TeamCardView key={t.id} team={t} people={people} pending={pending} run={run} onEdit={() => setDialog({ mode: 'edit', team: t })} onDelete={() => onDelete(t)} />
          ))}
        </div>
      )}

      {dialog && (
        <TeamDialog
          mode={dialog.mode}
          team={dialog.mode === 'edit' ? dialog.team : undefined}
          pending={pending}
          onSave={onDialogSave}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}

function TeamCardView({ team, people, pending, run, onEdit, onDelete }: {
  team: TeamCard
  people: PersonView[]
  pending: boolean
  run: (fn: () => Promise<void>) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const memberIds = new Set(team.members.map(m => m.id))
  const addable = people.filter(p => !memberIds.has(p.id)).sort((a, b) => a.full_name.localeCompare(b.full_name))

  return (
    <div className="border border-slate-200 bg-white rounded-[16px] overflow-hidden shadow-[0_1px_2px_rgba(1,35,88,.06)] flex flex-col h-[560px]">
      <div className="h-[5px] shrink-0" style={{ background: team.color }} />
      <div className="px-[22px] pt-5 pb-[22px] flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-[11px] h-[11px] rounded-[3px] shrink-0" style={{ background: team.color }} />
            <h3 className="font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink m-0 truncate">{team.name}</h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={onEdit} disabled={pending} aria-label="Rename team" className="inline-flex w-8 h-8 items-center justify-center rounded-[9px] text-muted transition-colors hover:bg-subtle hover:text-tn-ink disabled:opacity-50">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
            </button>
            <button type="button" onClick={onDelete} disabled={pending} aria-label="Delete team" className="inline-flex w-8 h-8 items-center justify-center rounded-[9px] text-muted transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
            </button>
          </div>
        </div>

        <div className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-wider uppercase text-muted mt-[18px] mb-2 shrink-0">Members · {team.memberCount}</div>
        {/* Only the member list scrolls, the card keeps a fixed height and the
            tool-access footer stays pinned at the bottom. */}
        <div className="flex flex-col gap-0.5 flex-1 min-h-0 overflow-y-auto -mr-2 pr-2">
          {team.members.length === 0 && <span className="text-[12.5px] text-muted italic">No members yet.</span>}
          {team.members.map(m => {
            const posPill = teamPositionPill(m.position)
            const access = roleTypePill(m.roleType)
            const isLeader = m.position === 'team_leader'
            const isFounder = m.position === 'founder'
            return (
              <div key={m.id} className="group/mem flex items-center gap-2.5 py-[5px]">
                <Avatar name={m.name} avatarUrl={m.avatarUrl} size={28} color={TEAM_COLOR[m.teamKey]} />
                <span className="text-[13.5px] text-foreground font-semibold truncate min-w-0">{m.name}</span>
                {/* Right cluster: the ACCESS (contact type) shown discreetly only when
                    it's elevated, then the TEAM POSITION prominently. On hover both
                    give way to the row actions (toggle position / remove). */}
                <span className="ml-auto shrink-0 flex items-center gap-1.5 justify-end">
                  {m.roleType !== 'user' && (
                    <span title={`Access: ${access.label}`} className="group-hover/mem:hidden inline-flex items-center gap-1 font-(family-name:--font-display) font-bold text-[8.5px] tracking-wide uppercase text-muted">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                      {access.label}
                    </span>
                  )}
                  <span className={`group-hover/mem:hidden font-(family-name:--font-display) font-extrabold text-[9px] tracking-wide uppercase rounded-full px-2 py-0.5 ${PILL_CLASS[posPill.kind]}`}>{posPill.label}</span>
                  <span className="hidden group-hover/mem:flex items-center gap-1">
                    {/* Quick promote/demote between Team Leader and Collaborator.
                        Founder is a deliberate role, set it in the person's card. */}
                    {!isFounder && (
                      <button type="button" title={isLeader ? 'Set as Collaborator' : 'Set as Team Leader'} disabled={pending} onClick={() => run(() => setTeamMemberPosition(team.id, m.id, isLeader ? 'collaborator' : 'team_leader'))} className="inline-flex w-7 h-7 items-center justify-center rounded-[8px] text-muted hover:bg-tn-teal-soft hover:text-tn-teal disabled:opacity-50">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={isLeader ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                      </button>
                    )}
                    <button type="button" title="Remove from team" disabled={pending} onClick={() => run(() => removeTeamMember(team.id, m.id))} className="inline-flex w-7 h-7 items-center justify-center rounded-[8px] text-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </button>
                  </span>
                </span>
              </div>
            )
          })}
        </div>

        {addable.length > 0 && (
          <div className="shrink-0 mt-3">
            <Select
              fullWidth
              value=""
              disabled={pending}
              onChange={id => { if (id) run(() => addTeamMember(team.id, id)) }}
              options={addable.map(p => ({ value: p.id, label: p.full_name }))}
              placeholder="+ Add member…"
              mutePlaceholder={false}
              ariaLabel="Add member to team"
              className="text-[13px] font-semibold text-tn-teal bg-white border border-dashed border-slate-300 rounded-[10px] px-3 py-2.5 cursor-pointer hover:border-tn-teal focus:outline-none focus:border-tn-teal"
            />
          </div>
        )}

        <div className="shrink-0 mt-[18px] pt-4 border-t border-slate-100">
        <div className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-wider uppercase text-muted mb-[3px]">Tool access</div>
        <p className="text-[11px] text-muted leading-snug mb-2.5">Who on this team can open each tool. <b className="text-foreground font-semibold">Off</b> hides it.</p>
        <div className="flex flex-col gap-1.5">
          {TOOLS.map(tool => {
            const current = team.tools.find(t => t.toolKey === tool.key)?.audience ?? null
            return (
              <div key={tool.key} className="flex items-center justify-between gap-2.5">
                <span className="inline-flex items-center gap-1.5 min-w-0">
                  <span className="text-[12.5px] font-semibold text-foreground truncate">{tool.label}</span>
                  {tool.sensitive && (
                    <span title="Exposes money / PII" aria-label="Sensitive" className="shrink-0 inline-flex text-amber-500">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    </span>
                  )}
                </span>
                <div className="inline-flex shrink-0 bg-subtle rounded-[9px] p-0.5" role="group" aria-label={`${tool.label} access`}>
                  {(['off', 'lead', 'all'] as const).map(val => {
                    const active = val === 'off' ? current === null : current === val
                    const label = val === 'off' ? 'Off' : val === 'lead' ? 'Lead' : 'Team'
                    const title = val === 'off' ? 'No access' : val === 'lead' ? 'Team lead only' : 'Whole team'
                    return (
                      <button
                        key={val}
                        type="button"
                        disabled={pending}
                        aria-pressed={active}
                        title={title}
                        onClick={() => run(() => (val === 'off' ? removeTeamTool(team.id, tool.key) : setTeamTool(team.id, tool.key, val)))}
                        className={`font-(family-name:--font-display) font-extrabold text-[10.5px] rounded-[7px] px-[9px] py-1 transition-colors disabled:opacity-50 ${
                          active ? 'bg-white text-tn-ink shadow-[0_1px_2px_rgba(1,35,88,.12)]' : 'text-muted hover:text-tn-ink'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        </div>
      </div>
    </div>
  )
}

// TeamDialog: styled create/rename modal (replaces window.prompt). Same visual
// language as the rest of the portal: a colour accent bar, a name field, and the
// shared team colour palette. Esc or a backdrop click cancels; Enter saves.
function TeamDialog({ mode, team, pending, onSave, onClose }: {
  mode: 'new' | 'edit'
  team?: TeamCard
  pending: boolean
  onSave: (name: string, color: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState(team?.name ?? '')
  const [color, setColor] = useState(team?.color ?? DEFAULT_COLOR)
  const canSave = name.trim().length > 0 && !pending

  // Close on Escape, matches the rest of the portal's modals.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function submit() { if (canSave) onSave(name.trim(), color) }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-tn-ink/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={mode === 'new' ? 'New team' : 'Rename team'}
        className="relative w-full max-w-[420px] bg-white rounded-[18px] border border-slate-200 shadow-[0_40px_80px_-24px_rgba(1,35,88,.5)] overflow-hidden">
        <div className="h-[6px]" style={{ background: color }} />
        <div className="p-6">
          <h2 className="font-(family-name:--font-display) font-extrabold text-[19px] text-tn-ink">{mode === 'new' ? 'New team' : 'Rename team'}</h2>
          <p className="text-[13px] text-muted mt-1">{mode === 'new' ? 'Name the team and pick a colour.' : 'Update the team name and colour.'}</p>

          <label className="block mt-5">
            <span className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-wider uppercase text-muted">Team name</span>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit() }}
              placeholder="e.g. Clinical Ops"
              className="mt-1.5 w-full text-[14px] text-foreground bg-white border border-slate-300 rounded-[10px] px-3 py-2.5 focus:outline-none focus:border-tn-teal focus:ring-2 focus:ring-tn-teal/20"
            />
          </label>

          <div className="mt-5">
            <span className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-wider uppercase text-muted">Team colour</span>
            <div className="grid grid-cols-7 gap-2 mt-2">
              {COLOR_PALETTE.map(c => {
                const selected = c === color
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={`Colour ${c}`}
                    aria-pressed={selected}
                    className="w-8 h-8 rounded-full inline-flex items-center justify-center transition-transform hover:scale-110 focus:outline-none"
                    style={{ background: c, transform: selected ? 'scale(1.15)' : undefined, outline: selected ? '2px solid var(--tn-ink)' : undefined, outlineOffset: '2px' }}
                  >
                    {selected && (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={textColorFor(c)} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 mt-7">
            <button type="button" onClick={onClose} disabled={pending}
              className="font-(family-name:--font-display) font-extrabold text-[13px] text-muted rounded-[10px] px-4 py-2.5 transition-colors hover:bg-subtle disabled:opacity-50">
              Cancel
            </button>
            <button type="button" onClick={submit} disabled={!canSave}
              className="font-(family-name:--font-display) font-extrabold text-[13px] text-white bg-tn-primary rounded-[10px] px-5 py-2.5 shadow-[0_10px_24px_-12px_rgba(1,35,88,.7)] transition-all hover:brightness-110 disabled:opacity-50">
              <span className="text-[#ffffff]">{mode === 'new' ? 'Create team' : 'Save changes'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
