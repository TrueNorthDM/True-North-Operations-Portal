// Screen 1.3 with the handoff's own people. Development only, like its sibling.

import { notFound } from 'next/navigation'
import { TeamPeople } from '@/components/team/TeamPeople'
import type { RestrictedPerson, RestrictedTeam } from '@/components/admin/RestrictedDirectory'

export const dynamic = 'force-dynamic'

const person = (
  id: string, name: string, title: string, teamName: string,
  teamKey: RestrictedPerson['teamKey'], roleType: string, active: boolean, self = false,
): RestrictedPerson => ({
  id, name, title, teamName, teamKey,
  avatarUrl: null,
  roleType,
  status: active ? 'active' : 'inactive',
  detail: self
    ? { managerName: 'Wendy Clark', workEmail: 'arnaldo@truenorth.com', phone: null, location: 'Brazil', hireDate: '2021-03-01', employmentType: 'contractor' }
    : null,
})

const PEOPLE: RestrictedPerson[] = [
  person('me', 'Arnaldo Oliveira', 'Operations', 'SEO', 'seo', 'admin', true, true),
  person('p2', 'Amy Marsh', 'SEO Specialist', 'SEO', 'seo', 'user', true),
  person('p3', 'Kevin Brown', 'Analyst', 'SEO', 'seo', 'user', true),
  person('p4', 'Lana Prado', 'Translator', 'Writing', 'writing', 'team_leader', true),
  person('p5', 'Wendy Clark', 'Account Director', 'Web', 'other', 'admin_assistant', false),
]

const TEAMS: RestrictedTeam[] = [
  {
    id: 't1', name: 'SEO', teamKey: 'seo',
    members: [
      { id: 'p2', name: 'Amy Marsh', title: 'SEO Specialist', avatarUrl: null, positionLabel: 'Lead' },
      { id: 'p3', name: 'Kevin Brown', title: 'Analyst', avatarUrl: null, positionLabel: 'Member' },
    ],
    tools: [
      { label: 'Time report', audience: 'lead' },
      { label: 'Publishing Goals', audience: 'all' },
    ],
  },
  {
    id: 't2', name: 'Writing', teamKey: 'writing',
    members: [{ id: 'p4', name: 'Lana Prado', title: 'Translator', avatarUrl: null, positionLabel: 'Member' }],
    tools: [],
  },
  {
    id: 't3', name: 'Web', teamKey: 'other',
    members: [{ id: 'p5', name: 'Wendy Clark', title: 'Account Director', avatarUrl: null, positionLabel: 'Lead' }],
    tools: [{ label: 'Href Link Management', audience: 'all' }],
  },
]

export default function DesignCheckTeam() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-[1340px] mx-auto space-y-6">
        <div className="flex items-center gap-2 text-[13px]">
          <span className="font-semibold text-muted">Dashboard</span>
          <span className="text-[#cbd2da]">/</span>
          <span className="font-semibold text-tn-ink">My Work / My Team</span>
        </div>

        <div className="flex items-start justify-between gap-5 flex-wrap pb-[18px] border-b border-[#e4e7ec]">
          <div>
            <h2 className="font-(family-name:--font-display) font-extrabold text-[26px] tracking-[-.01em] text-tn-ink m-0">People</h2>
            <p className="text-[14.5px] text-muted mt-1.5 m-0 max-w-[640px] leading-[1.6]">
              Your team, and your own profile. Open your card for the full details; everyone else shows name, role and team.
            </p>
          </div>
          <div className="flex items-center bg-subtle border border-[#e4e7ec] rounded-[11px] p-1">
            <span className="inline-flex items-center gap-[7px] px-[15px] py-2 rounded-[8px] text-muted font-(family-name:--font-display) font-extrabold text-[13.5px]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>
              My Work
            </span>
            <span className="inline-flex items-center gap-[7px] px-[15px] py-2 rounded-[8px] bg-white text-tn-ink shadow-[0_1px_3px_rgba(1,35,88,.14)] font-(family-name:--font-display) font-extrabold text-[13.5px]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              My Team
            </span>
          </div>
        </div>

        <TeamPeople people={PEOPLE} selfId="me" teams={TEAMS} showTeams />
      </div>
    </div>
  )
}
