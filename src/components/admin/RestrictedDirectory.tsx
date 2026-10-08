'use client'

/**
 * RestrictedDirectory: the People directory at levels 1 and 2 (see
 * access/surfaces.ts). Level 3 gets the full DirectoryTabs instead.
 *
 * Level 1  the People list, scoped to the teams the viewer belongs to. A name
 *          opens that person's page when page-rights.ts allows it.
 * Level 2  adds a Teams tab for those same teams, showing who can open which
 *          tool, read-only.
 *
 * Read-only by construction: there are no edit affordances here, so none can
 * leak to someone who shouldn't have them. Sensitive comp/HR fields (rate, DOB,
 * salary, address) are never sent to this view for anyone; the server builds
 * this lean shape so nothing sensitive reaches the browser at all.
 */

import Link from 'next/link'
import { SearchField } from '@/components/ui/SearchField'
import { tabKeys } from '@/components/ui/tab-keys'
import { useState } from 'react'
import { Avatar } from '@/components/Avatar'
import { roleTypePill, statusPill, PILL_CLASS, type TeamKey } from '@/lib/directory/people-types'

export interface RestrictedTeamMember {
  id: string
  name: string
  title: string | null
  avatarUrl: string | null
  positionLabel: string
}

export interface RestrictedTeamTool {
  label: string
  /** 'lead' = only the team lead, 'all' = every member. */
  audience: 'lead' | 'all'
}

export interface RestrictedTeam {
  id: string
  name: string
  teamKey: TeamKey
  /**
   * Resolved once by the loader, from teams.color with the key map as the
   * fallback. Carried as data rather than looked up in each component,
   * because three components looking it up their own way is how the same
   * person ended up three different colours.
   */
  color: string
  members: RestrictedTeamMember[]
  /** Level 2 only; null at level 1, which hides the tool-access block. */
  tools: RestrictedTeamTool[] | null
}

export interface RestrictedPerson {
  id: string
  name: string
  title: string | null
  teamName: string | null
  teamKey: TeamKey
  /** See RestrictedTeam.color. */
  color: string
  avatarUrl: string | null
  roleType: string
  status: 'active' | 'inactive'
  /** Their page, when the viewer may open it (lib/directory/page-rights.ts); null otherwise. */
  href: string | null
}

export function RestrictedDirectory({
  people,
  teams,
  showTeams,
}: {
  people: RestrictedPerson[]
  teams: RestrictedTeam[]
  /** Level 2, the Teams tab. Level 1 gets the People list on its own. */
  showTeams: boolean
}) {
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<'people' | 'teams'>('people')

  const needle = q.trim().toLowerCase()
  const rows = needle
    ? people.filter(p =>
        p.name.toLowerCase().includes(needle) ||
        (p.title ?? '').toLowerCase().includes(needle) ||
        (p.teamName ?? '').toLowerCase().includes(needle))
    : people

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink">People</h1>
        <p className="mt-1.5 text-[15px] text-muted leading-relaxed">
          {people.length > 1
            ? 'Your team, and your own page. A name with an arrow opens that person\u2019s page; everyone else shows name, role and team.'
            : 'Your own profile. You are not on a team yet, so no colleagues are listed.'}
        </p>
      </div>

      {showTeams && (
        <div role="tablist" aria-label="Directory" onKeyDown={tabKeys(['people', 'teams'] as const, tab, setTab)} className="border-b border-slate-200 flex items-center gap-1">
          {([['people', 'People'], ['teams', 'Teams']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`rdir-tab-${key}`}
              data-tab={key}
              aria-selected={tab === key}
              tabIndex={tab === key ? 0 : -1}
              onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-sm font-semibold -mb-px border-b-2 transition-colors ${
                tab === key ? 'border-tn-teal text-tn-ink' : 'border-transparent text-muted hover:text-tn-ink hover:border-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {showTeams && tab === 'teams' && <TeamsView teams={teams} />}

      <div className={showTeams && tab === 'teams' ? 'hidden' : 'contents'}>
      <SearchField
        value={q}
        onChange={setQ}
        placeholder="Search people…"
        className="w-full max-w-[420px]"
      />

      <div className="border border-slate-200 bg-white rounded-[16px] overflow-hidden shadow-[0_1px_2px_rgba(1,35,88,.06)]">
        {rows.length === 0 && <div className="px-[22px] py-[52px] text-center text-sm text-muted">No one matches “{q}”.</div>}
        {rows.map((p, i) => {
          const rp = roleTypePill(p.roleType)
          const sp = statusPill(p.status === 'active')
          const cls = `flex items-center gap-3.5 px-[22px] py-3 ${i === 0 ? '' : 'border-t border-slate-200'} ${p.href ? 'cursor-pointer hover:bg-subtle transition-colors' : ''}`
          const body = (
            <>
              <Avatar name={p.name} avatarUrl={p.avatarUrl} size={36} color={p.color} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-foreground truncate">{p.name}</span>
                  <span className={`font-(family-name:--font-display) font-extrabold text-[9px] tracking-wide uppercase rounded-full px-2 py-0.5 shrink-0 ${PILL_CLASS[rp.kind]}`}>{rp.label}</span>
                </span>
                <span className="block text-[12.5px] text-muted truncate">{p.title ?? '-'}</span>
              </span>
              <span className="hidden sm:block text-[12.5px] text-muted truncate max-w-[160px]">{p.teamName ?? '-'}</span>
              <span className={`font-(family-name:--font-display) font-extrabold text-[9px] tracking-wide uppercase rounded-full px-2 py-0.5 shrink-0 ${PILL_CLASS[sp.kind]}`}>{sp.label}</span>
              {p.href && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-slate-300 shrink-0"><path d="M9 18l6-6-6-6" /></svg>
              )}
            </>
          )
          return p.href
            ? <Link key={p.id} href={p.href} className={cls}>{body}</Link>
            : <div key={p.id} className={cls}>{body}</div>
        })}
      </div>

      </div>

    </div>
  )
}

// ── Teams tab (level 2) ─────────────────────────────────────────────────────
// The viewer's own teams, read-only. The tool-access block is what separates
// level 2 from level 1; it says who on the team can open each tool, without
// any way to change it.
function TeamsView({ teams }: { teams: RestrictedTeam[] }) {
  if (teams.length === 0) {
    return (
      <div className="rounded-[16px] border border-slate-200 bg-white px-5 py-12 text-center">
        <p className="text-sm font-semibold text-tn-ink m-0">You are not on a team yet</p>
        <p className="mt-1.5 text-[13px] text-muted m-0">Ask an admin to add you to one.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
      {teams.map(t => (
        <div key={t.id} className="rounded-[16px] border border-slate-200 bg-white overflow-hidden shadow-[0_1px_2px_rgba(1,35,88,.06)]">
          <div className="h-1.5" style={{ background: t.color }} />
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink m-0 truncate">{t.name}</h3>
              <span className="shrink-0 text-[11px] text-muted">{t.members.length} {t.members.length === 1 ? 'member' : 'members'}</span>
            </div>

            <div className="space-y-2">
              {t.members.map(m => (
                <div key={m.id} className="flex items-center gap-2.5">
                  <Avatar name={m.name} avatarUrl={m.avatarUrl} size={28} color={t.color} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-foreground truncate">{m.name}</span>
                    {m.title && <span className="block text-[11.5px] text-muted truncate">{m.title}</span>}
                  </span>
                  <span className="shrink-0 font-(family-name:--font-display) font-extrabold text-[9px] tracking-wide uppercase rounded-full px-2 py-0.5 bg-slate-100 text-slate-500">
                    {m.positionLabel}
                  </span>
                </div>
              ))}
            </div>

            {t.tools && (
              <div className="pt-3.5 border-t border-slate-100">
                <p className="font-(family-name:--font-display) font-extrabold text-[10px] uppercase tracking-wide text-muted m-0 mb-2">Tool access</p>
                {t.tools.length === 0 ? (
                  <p className="text-[12.5px] text-muted m-0">No tools granted to this team.</p>
                ) : (
                  <ul className="space-y-1.5 list-none p-0 m-0">
                    {t.tools.map(tool => (
                      <li key={tool.label} className="flex items-center justify-between gap-2 text-[12.5px]">
                        <span className="text-foreground truncate">{tool.label}</span>
                        <span className="shrink-0 font-(family-name:--font-display) font-extrabold text-[9px] tracking-wide uppercase rounded-full px-2 py-0.5 bg-tn-teal-soft text-tn-teal">
                          {tool.audience === 'lead' ? 'Lead only' : 'Whole team'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
