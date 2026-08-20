'use client'

/**
 * My Team, the People list, built to screen 1.3 of the handoff.
 *
 * A separate component from RestrictedDirectory rather than a restyle of it:
 * that one also draws the Directory at level 3, where a row carries more and
 * every card opens. Two screens with different jobs were sharing one set of
 * classes, and the handoff only redraws this one.
 *
 * Only the viewer's own card opens at levels 1 and 2, which is why the chevron
 * appears on exactly one row: it points at the thing that can be pressed.
 */

import { useState } from 'react'
import { SearchField } from '@/components/ui/SearchField'
import { roleTypePill } from '@/lib/directory/people-types'
import { ProfileCard, type RestrictedPerson, type FullProfile, type RestrictedTeam } from '@/components/admin/RestrictedDirectory'
import { TEAM_COLOR } from '@/lib/directory/people-types'

// The pill shape the handoff uses for both role and status: 9px, uppercase,
// fully round, and never allowed to grow with its row.
const PILL = 'inline-flex items-center shrink-0 font-(family-name:--font-display) font-extrabold text-[9px] tracking-[.05em] uppercase rounded-full px-2 py-[3px]'

/** Avatar colours follow the person's team, as everywhere else in the portal. */
const AVATAR_COLOUR: Record<string, string> = {
  seo: '#1E7D7F',
  writing: '#579BFC',
  graphics: '#7c3aed',
  web: '#012358',
  other: '#012358',
}

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()

/**
 * One team, as a card: a colour bar, who is on it, and what it can reach.
 *
 * Tool access is the whole difference between directory level 1 and level 2,
 * so its absence is a state and not a blank: level 1 gets no block at all,
 * level 2 with no grants gets a sentence saying so.
 */
function TeamCard({ team }: { team: RestrictedTeam }) {
  const colour = TEAM_COLOR[team.teamKey] ?? '#012358'
  return (
    <div className="border border-[#e4e7ec] bg-white rounded-[16px] overflow-hidden shadow-[0_1px_2px_rgba(1,35,88,.06)]">
      <div className="h-1.5" style={{ background: colour }} />
      <div className="p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink m-0">{team.name}</h3>
          <span className="text-[11px] text-muted">
            {team.members.length} {team.members.length === 1 ? 'member' : 'members'}
          </span>
        </div>

        <div className="flex flex-col gap-2.5">
          {team.members.map(m => (
            <div key={m.id} className="flex items-center gap-2.5">
              <span
                className="inline-flex shrink-0 w-7 h-7 rounded-full items-center justify-center font-(family-name:--font-display) font-extrabold text-[11px] text-white"
                style={{ background: colour }}
              >
                {initialsOf(m.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-tn-ink truncate">{m.name}</span>
                <span className="block text-[11.5px] text-muted truncate">{m.title ?? '-'}</span>
              </span>
              <span className={`${PILL} bg-[#f1f3f6] text-[#6b7c95]`}>{m.positionLabel}</span>
            </div>
          ))}
        </div>

        {team.tools && (
          <div className="pt-3.5 mt-3.5 border-t border-[#eceff3]">
            <p className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.07em] uppercase text-muted m-0 mb-2.5">
              Tool access
            </p>
            {team.tools.length === 0 ? (
              <p className="text-[12.5px] text-muted m-0">No tools granted to this team.</p>
            ) : (
              <div className="flex flex-col gap-[7px]">
                {team.tools.map(t => (
                  <div key={t.label} className="flex items-center justify-between gap-2 text-[12.5px] text-foreground">
                    {t.label}
                    <span className={`${PILL} bg-[rgba(30,125,127,.12)] text-tn-teal`}>
                      {t.audience === 'lead' ? 'Lead only' : 'Whole team'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function TeamPeople({
  people, selfId, profiles, teams = [], showTeams = false,
}: {
  people: RestrictedPerson[]
  selfId: string | null
  /** Full cards for the people this viewer may open, keyed by person id. */
  profiles?: Record<string, FullProfile>
  teams?: RestrictedTeam[]
  /** The Teams tab exists from directory level 2 up. */
  showTeams?: boolean
}) {
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<'people' | 'teams'>('people')
  const [openId, setOpenId] = useState<string | null>(null)
  const open = openId ? people.find(p => p.id === openId) ?? null : null

  const needle = q.trim().toLowerCase()
  const shown = needle
    ? people.filter(p => `${p.name} ${p.title ?? ''} ${p.teamName ?? ''}`.toLowerCase().includes(needle))
    : people

  return (
    <div>
      {showTeams && (
        <div className="flex items-center gap-0.5 border-b border-[#e4e7ec] mb-5">
          {(['people', 'teams'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-current={tab === t ? 'page' : undefined}
              className={`px-4 py-2.5 text-[13.5px] font-semibold -mb-px border-b-2 capitalize transition-colors ${
                tab === t ? 'border-tn-teal text-tn-ink' : 'border-transparent text-muted hover:text-tn-ink'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {showTeams && tab === 'teams' && (
        teams.length === 0
          ? <div className="border border-[#e4e7ec] bg-white rounded-[16px] px-6 py-12 text-center text-[13px] text-muted">You are not on a team yet.</div>
          : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {teams.map(t => <TeamCard key={t.id} team={t} />)}
            </div>
          )
      )}

      <div className={showTeams && tab === 'teams' ? 'hidden' : 'contents'}>
      <SearchField
        value={q}
        onChange={setQ}
        placeholder="Search people…"
        className="w-full sm:w-[420px] mb-4"
      />

      <div className="border border-[#e4e7ec] bg-white rounded-[16px] overflow-hidden shadow-[0_1px_2px_rgba(1,35,88,.06)]">
        {shown.length === 0 && (
          <div className="px-[22px] py-13 text-center text-[13px] text-muted">No one matches “{q}”.</div>
        )}

        {shown.map((p, i) => {
          const role = roleTypePill(p.roleType)
          const active = p.status === 'active'
          const self = p.id === selfId
          // Openable and "is me" are the same thing at these levels, but they
          // are asked separately: the row opens because there is a card to
          // open, not because of who it belongs to.
          const openable = p.detail !== null

          return (
            <div
              key={p.id}
              onClick={() => { if (openable) setOpenId(p.id) }}
              className={`flex items-center gap-3.5 px-[22px] py-3 transition-colors ${i > 0 ? 'border-t border-[#eceff3]' : ''} ${
                openable ? 'cursor-pointer hover:bg-[#f8f7f3]' : ''
              }`}
            >
              <span
                className="inline-flex shrink-0 w-9 h-9 rounded-full items-center justify-center font-(family-name:--font-display) font-extrabold text-[12.5px] text-white"
                style={{ background: AVATAR_COLOUR[p.teamKey] ?? AVATAR_COLOUR.other }}
              >
                {initialsOf(p.name)}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-semibold text-tn-ink">{p.name}</span>
                  <span className={`${PILL} bg-[#eef2f7] text-[#5b6b82]`}>{role.label}</span>
                  {self && <span className={`${PILL} bg-[rgba(30,125,127,.12)] text-tn-teal`}>You</span>}
                </span>
                <span className="block text-[12.5px] text-muted mt-0.5">{p.title ?? '-'}</span>
              </span>

              <span className="text-[12.5px] text-muted w-40 shrink-0">{p.teamName ?? '-'}</span>

              <span className={`${PILL} ${active ? 'bg-[#e6f6ee] text-[#0d7a4f]' : 'bg-[#f1f3f6] text-muted'}`}>
                {active ? 'Active' : 'Inactive'}
              </span>

              {/* Present only where there is somewhere to go. */}
              <span className="shrink-0 w-4 text-[#cbd2da] inline-flex justify-end">
                {openable && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                )}
              </span>
            </div>
          )
        })}
      </div>

      {/* The same card the Directory and My profile open, so a person sees one
          profile everywhere rather than three that drifted apart. */}
      </div>

      {open && profiles?.[open.id] && (
        <ProfileCard profile={profiles[open.id]} isSelf={open.id === selfId} onClose={() => setOpenId(null)} />
      )}
    </div>
  )
}
