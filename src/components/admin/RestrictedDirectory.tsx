'use client'

/**
 * RestrictedDirectory: the People directory at levels 1 and 2 (see
 * access/surfaces.ts). Level 3 gets the full DirectoryTabs instead.
 *
 * Level 1  the People list, scoped to the teams the viewer belongs to, and only
 *          their own card is openable.
 * Level 2  adds a Teams tab for those same teams, showing who can open which
 *          tool, read-only.
 *
 * Read-only by construction: there are no edit affordances here, so none can
 * leak to someone who shouldn't have them. Sensitive comp/HR fields (rate, DOB,
 * salary, address) are never sent to this view for anyone; the server builds
 * this lean shape so nothing sensitive reaches the browser at all.
 */

import Link from 'next/link'
import { useState } from 'react'
import { Avatar } from '@/components/Avatar'
import { roleTypePill, statusPill, formatDate, teamKeyFromName, typePill, timePill, ynPill, lifecyclePill, PILL_CLASS, TEAM_COLOR, type TeamKey } from './people-types'
import { Badge, Row, Section, ManagedNote, txt, mail } from '@/components/profile/profile-parts'

export interface RestrictedPersonDetail {
  managerName: string | null
  workEmail: string | null
  phone: string | null
  location: string | null
  hireDate: string | null
  employmentType: string | null
}

/**
 * A full profile card, the same fields My profile shows. Built for the people
 * the viewer may open: only themselves at directory levels 1 and 2, everyone on
 * their teams at level 3.
 */
export interface FullProfile {
  name: string
  lastName: string | null
  title: string | null
  avatarUrl: string | null
  roleType: string
  active: boolean
  teamNames: string[]
  personalEmail: string | null
  phone: string | null
  whatsapp: string | null
  location: string | null
  dateOfBirth: string | null
  employmentType: string | null
  schedule: string | null
  weeklyHours: number | null
  managerName: string | null
  alsoReportsToName: string | null
  managerNameText: string | null
  reportsToManager: string | null
  onboardingStatus: string | null
  offboardingStatus: string | null
  emailTrueNorth: string | null
  emailGoodnews: string | null
  emailCoe: string | null
  hireDate: string | null
  leftOn: string | null
}

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
  avatarUrl: string | null
  roleType: string
  status: 'active' | 'inactive'
  detail: RestrictedPersonDetail | null
}

const EMPLOYMENT_LABEL: Record<string, string> = { us: 'US employee', contractor: 'Contractor' }

export function RestrictedDirectory({
  people,
  teams,
  showTeams,
  profiles,
  selfId,
}: {
  people: RestrictedPerson[]
  teams: RestrictedTeam[]
  /** Level 2, the Teams tab. Level 1 gets the People list on its own. */
  showTeams: boolean
  /** Whose full card can be opened, keyed by person id. */
  profiles?: Record<string, FullProfile>
  selfId?: string | null
}) {
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [tab, setTab] = useState<'people' | 'teams'>('people')

  const needle = q.trim().toLowerCase()
  const rows = needle
    ? people.filter(p =>
        p.name.toLowerCase().includes(needle) ||
        (p.title ?? '').toLowerCase().includes(needle) ||
        (p.teamName ?? '').toLowerCase().includes(needle))
    : people
  const open = openId ? people.find(p => p.id === openId) ?? null : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink">People</h1>
        <p className="mt-1.5 text-[15px] text-muted leading-relaxed">
          {people.length > 1
            ? 'Your team, and your own profile. Open your card for the full details; everyone else shows name, role and team.'
            : 'Your own profile. You are not on a team yet, so no colleagues are listed.'}
        </p>
      </div>

      {showTeams && (
        <div className="border-b border-slate-200 flex items-center gap-1">
          {([['people', 'People'], ['teams', 'Teams']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-current={tab === key ? 'page' : undefined}
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
      <input
        type="text"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search people…"
        className="w-full max-w-[420px] text-[14px] text-tn-ink bg-white border border-slate-200 rounded-[12px] px-4 py-2.5 focus:outline-none focus:border-tn-teal focus:ring-2 focus:ring-tn-teal/20"
      />

      <div className="border border-slate-200 bg-white rounded-[16px] overflow-hidden shadow-[0_1px_2px_rgba(1,35,88,.06)]">
        {rows.length === 0 && <div className="px-[22px] py-[52px] text-center text-sm text-muted">No one matches “{q}”.</div>}
        {rows.map((p, i) => {
          const rp = roleTypePill(p.roleType)
          const sp = statusPill(p.status === 'active')
          const openable = p.detail !== null
          return (
            <div
              key={p.id}
              role={openable ? 'button' : undefined}
              tabIndex={openable ? 0 : undefined}
              onClick={openable ? () => setOpenId(p.id) : undefined}
              onKeyDown={openable ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenId(p.id) } } : undefined}
              className={`flex items-center gap-3.5 px-[22px] py-3 ${i === 0 ? '' : 'border-t border-slate-200'} ${openable ? 'cursor-pointer hover:bg-subtle transition-colors' : ''}`}
            >
              <Avatar name={p.name} avatarUrl={p.avatarUrl} size={36} color={TEAM_COLOR[p.teamKey]} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-foreground truncate">{p.name}</span>
                  <span className={`font-(family-name:--font-display) font-extrabold text-[9px] tracking-wide uppercase rounded-full px-2 py-0.5 shrink-0 ${PILL_CLASS[rp.kind]}`}>{rp.label}</span>
                </span>
                <span className="block text-[12.5px] text-muted truncate">{p.title ?? '-'}</span>
              </span>
              <span className="hidden sm:block text-[12.5px] text-muted truncate max-w-[160px]">{p.teamName ?? '-'}</span>
              <span className={`font-(family-name:--font-display) font-extrabold text-[9px] tracking-wide uppercase rounded-full px-2 py-0.5 shrink-0 ${PILL_CLASS[sp.kind]}`}>{sp.label}</span>
              {openable && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-slate-300 shrink-0"><path d="M9 18l6-6-6-6" /></svg>
              )}
            </div>
          )
        })}
      </div>

      </div>

      {open && profiles?.[open.id] ? (
        <ProfileCard profile={profiles[open.id]} isSelf={open.id === selfId} onClose={() => setOpenId(null)} />
      ) : open && open.detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-tn-ink/40" onClick={() => setOpenId(null)} />
          <div className="relative w-full max-w-[420px] bg-white rounded-[18px] shadow-[0_30px_70px_-20px_rgba(1,35,88,.5)] overflow-hidden">
            <div className="px-6 pt-6 pb-5 flex items-center gap-3.5 border-b border-slate-100">
              <Avatar name={open.name} avatarUrl={open.avatarUrl} size={52} color={TEAM_COLOR[open.teamKey]} />
              <div className="min-w-0">
                <h2 className="font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink m-0 truncate">{open.name}</h2>
                <p className="text-[13px] text-muted mt-0.5 truncate">{open.title ?? '-'}</p>
              </div>
              <button type="button" onClick={() => setOpenId(null)} aria-label="Close" className="ml-auto shrink-0 inline-flex w-8 h-8 items-center justify-center rounded-[9px] text-muted hover:bg-subtle hover:text-tn-ink transition-colors">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <dl className="px-6 py-4 text-[13.5px]">
              <DetailRow label="Team" value={open.teamName} />
              <DetailRow label="Manager" value={open.detail.managerName} />
              <DetailRow label="Work email" value={open.detail.workEmail} />
              <DetailRow label="Phone" value={open.detail.phone} />
              <DetailRow label="Location" value={open.detail.location} />
              <DetailRow label="Employment" value={open.detail.employmentType ? EMPLOYMENT_LABEL[open.detail.employmentType] ?? open.detail.employmentType : null} />
              <DetailRow label="Start date" value={formatDate(open.detail.hireDate)} />
            </dl>
          </div>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-50 last:border-0">
      <dt className="text-muted shrink-0">{label}</dt>
      <dd className="font-semibold text-foreground text-right min-w-0 truncate">{value || '-'}</dd>
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
          <div className="h-1.5" style={{ background: TEAM_COLOR[t.teamKey] }} />
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink m-0 truncate">{t.name}</h3>
              <span className="shrink-0 text-[11px] text-muted">{t.members.length} {t.members.length === 1 ? 'member' : 'members'}</span>
            </div>

            <div className="space-y-2">
              {t.members.map(m => (
                <div key={m.id} className="flex items-center gap-2.5">
                  <Avatar name={m.name} avatarUrl={m.avatarUrl} size={28} color={TEAM_COLOR[t.teamKey]} />
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

// ── The full profile card ───────────────────────────────────────────────────
// Deliberately the SAME layout as the My profile page, in a popup, built from
// the same shared parts (components/profile/profile-parts) so the two cannot
// drift into lookalikes. Read-only either way: editing your own details still
// lives on My profile, the one place that owns those writes.
function ProfileCard({ profile: p, isSelf, onClose }: { profile: FullProfile; isSelf: boolean; onClose: () => void }) {
  const teamKey = teamKeyFromName(p.teamNames[0])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={`${p.name} profile`}>
      <div className="fixed inset-0 bg-tn-ink/40" onClick={onClose} />
      <div className="relative w-full max-w-[920px] my-auto rounded-[18px] border border-slate-200 bg-white overflow-hidden shadow-[0_30px_70px_-20px_rgba(1,35,88,.5)]">
        {/* header, same proportions as the page */}
        <div className="px-8 pt-8 pb-6 border-b border-slate-200 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-6 min-w-0">
            <Avatar name={p.name} avatarUrl={p.avatarUrl} size={120} color={TEAM_COLOR[teamKey]} />
            <div className="min-w-0">
              <h2 className="font-(family-name:--font-display) font-extrabold text-[27px] text-tn-ink leading-tight m-0">{p.name}</h2>
              <p className="text-[15px] text-muted mt-1 font-semibold">{p.title || '-'}</p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {p.teamNames.length === 0 ? (
                  <span className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-wide uppercase rounded-full px-[11px] py-1" style={{ color: TEAM_COLOR[teamKey], background: `${TEAM_COLOR[teamKey]}1a` }}>No team</span>
                ) : p.teamNames.map(t => (
                  <span key={t} className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-wide uppercase rounded-full px-[11px] py-1" style={{ color: TEAM_COLOR[teamKeyFromName(t)], background: `${TEAM_COLOR[teamKeyFromName(t)]}1a` }}>{t}</span>
                ))}
                <Badge pill={roleTypePill(p.roleType)} />
                <Badge pill={statusPill(p.active)} />
              </div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="shrink-0 text-muted hover:text-tn-ink text-[26px] leading-none -mt-1">&times;</button>
        </div>

        {/* Part 1, the personal details (read-only here, editable on My profile) */}
        <div className="px-8 pt-6 pb-6 border-b border-slate-200">
          <div className="flex items-center justify-between gap-4 mb-5">
            <span className="font-(family-name:--font-display) font-extrabold text-[11px] tracking-[.06em] uppercase text-tn-teal">
              {isSelf ? 'Your details' : 'Personal details'}
            </span>
            {isSelf && (
              <Link href="/profile" className="inline-flex items-center gap-1.5 font-(family-name:--font-display) font-extrabold text-[12.5px] text-tn-teal">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                Edit
              </Link>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-[13px]">
            <Row label="Last name">{txt(p.lastName)}</Row>
            <Row label="Personal email">{mail(p.personalEmail)}</Row>
            <Row label="Phone / WhatsApp">{txt(p.phone)}</Row>
            <Row label="WhatsApp, same number">{txt(p.whatsapp)}</Row>
            <Row label="Location">{txt(p.location)}</Row>
            <Row label="Date of birth">{txt(formatDate(p.dateOfBirth))}</Row>
          </div>
        </div>

        {/* Part 2, HR-managed, read-only */}
        <div className="px-8 pt-6 pb-8">
          <ManagedNote own={isSelf} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
            <Section title="Employment">
              <Row label="Contact type"><Badge pill={roleTypePill(p.roleType)} /></Row>
              <Row label="Type"><Badge pill={typePill(p.employmentType)} /></Row>
              <Row label="Time"><Badge pill={timePill(p.schedule)} /></Row>
              <Row label="Weekly hours">{txt(p.weeklyHours != null ? `${p.weeklyHours} h / week` : null)}</Row>
              <Row label="Status"><Badge pill={statusPill(p.active)} /></Row>
            </Section>

            <Section title="Reporting">
              <Row label="Reports to">{txt(p.managerName)}</Row>
              <Row label={isSelf ? 'Do you report to a manager?' : 'Reports to a manager?'}><Badge pill={ynPill(p.reportsToManager)} /></Row>
              <Row label="Also reports to">{txt(p.alsoReportsToName)}</Row>
              <Row label="Manager (as stated)">{txt(p.managerNameText)}</Row>
            </Section>

            <Section title="Company emails">
              <Row label="True North">{mail(p.emailTrueNorth)}</Row>
              <Row label="GoodNews">{mail(p.emailGoodnews)}</Row>
              <Row label="COE">{mail(p.emailCoe)}</Row>
            </Section>

            <Section title="Onboarding">
              <Row label="Status"><Badge pill={lifecyclePill(p.onboardingStatus)} /></Row>
            </Section>

            <Section title="Offboarding">
              <Row label="Status"><Badge pill={lifecyclePill(p.offboardingStatus)} /></Row>
            </Section>

            <Section title="Dates">
              <Row label="Joined on">{txt(formatDate(p.hireDate))}</Row>
              <Row label="Left on">{txt(formatDate(p.leftOn))}</Row>
            </Section>
          </div>
        </div>
      </div>
    </div>
  )
}
