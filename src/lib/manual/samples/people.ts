/**
 * The System manual's People pictures (owner, 4 November 2026: the guides
 * show the real screens with made-up data). Everyone here is invented, and so
 * is every address, phone and date; the teams are True North's. Seen on
 * Tue, Nov 10, 2026. Nothing about pay, rates or HR notes is shown.
 */

import type { PersonView, PersonTeam, CardRights } from '@/lib/directory/people-types'
import { teamKeyFromName } from '@/lib/directory/people-types'
import type { TeamOption } from '@/components/admin/DirectoryTabs'
import type { PersonPageData, PageTeam } from '@/lib/directory/person-page-data'
import type { OrgPerson } from '@/lib/org/data'
import type { HrSection, HrNext, HrHolder } from '@/components/hr/HrGallery'
import { pageRights, type Relation } from '@/lib/directory/page-rights'
import { canAs } from '@/lib/access/simulate'
import { formatTenure, formatTenureShort, milestoneOf, tenureSince, yearColor } from '@/lib/tenure'

const NOW = new Date('2026-11-10T15:00:00Z')
const TN = 'truenorthdigitalmarketing.com'
const GN = 'goodnewsadvocates.org'

const TEAMC: Record<string, string> = { Graphics: '#C026D3', Leadership: '#1E40AF', SEO: '#F4C24A', Translation: '#14B8A6', Web: '#A99BD4', Writers: '#86C06A' }

interface Who {
  id: string; name: string; title: string; team: string; lead: boolean; level: string
  manager: string | null; hire: string; type: 'us' | 'contractor'; schedule: 'full' | 'part'; hours: number
  invited: string | null; account: boolean; twoStep: string | null; lastAccess: string | null
}

const PEOPLE: Who[] = [
  { id: 'p-chris', name: 'Chris Taylor', title: 'VP of Operations', team: 'Leadership', lead: true, level: 'super_admin', manager: null, hire: '2019-03-04', type: 'us', schedule: 'full', hours: 40, invited: '2026-06-09T12:00:00Z', account: true, twoStep: '2026-09-30T12:00:00Z', lastAccess: '2026-11-10T13:40:00Z' },
  { id: 'p-priya', name: 'Priya Nair', title: 'CISO', team: 'Leadership', lead: false, level: 'admin', manager: 'p-chris', hire: '2020-08-17', type: 'us', schedule: 'full', hours: 40, invited: '2026-06-09T12:00:00Z', account: true, twoStep: '2026-10-01T12:00:00Z', lastAccess: '2026-11-09T21:05:00Z' },
  { id: 'p-maria', name: 'Maria Gomez', title: 'HR Coordinator', team: 'Leadership', lead: false, level: 'admin', manager: 'p-chris', hire: '2021-01-11', type: 'us', schedule: 'part', hours: 25, invited: '2026-06-15T12:00:00Z', account: true, twoStep: '2026-10-02T12:00:00Z', lastAccess: '2026-11-10T12:10:00Z' },
  { id: 'p-jordan', name: 'Jordan Lee', title: 'Lead Writer', team: 'Writers', lead: true, level: 'team_leader', manager: 'p-chris', hire: '2022-05-02', type: 'contractor', schedule: 'full', hours: 40, invited: '2026-07-01T12:00:00Z', account: true, twoStep: null, lastAccess: '2026-11-08T18:30:00Z' },
  { id: 'p-alex', name: 'Alex Rivera', title: 'Writer', team: 'Writers', lead: false, level: 'user', manager: 'p-jordan', hire: '2024-11-18', type: 'us', schedule: 'full', hours: 40, invited: '2026-07-01T12:00:00Z', account: true, twoStep: '2026-10-03T12:00:00Z', lastAccess: '2026-11-10T14:20:00Z' },
  { id: 'p-sam', name: 'Sam Patel', title: 'SEO Specialist', team: 'SEO', lead: true, level: 'team_leader', manager: 'p-chris', hire: '2023-09-05', type: 'us', schedule: 'full', hours: 40, invited: '2026-11-03T12:00:00Z', account: false, twoStep: null, lastAccess: null },
  { id: 'p-ben', name: 'Ben Carter', title: 'Designer', team: 'Graphics', lead: false, level: 'user', manager: 'p-chris', hire: '2026-06-01', type: 'contractor', schedule: 'part', hours: 20, invited: null, account: false, twoStep: null, lastAccess: null },
]

const byId = new Map(PEOPLE.map(p => [p.id, p]))
const nameOf = (id: string | null) => (id ? byId.get(id)?.name ?? null : null)
const email = (p: Who, domain: string) => `${p.name.split(' ')[0].toLowerCase()}.${p.name.split(' ')[1].toLowerCase()}@${domain}`
const teamOf = (p: Who): PersonTeam => ({ teamId: `t-${p.team}`, teamName: p.team, teamKey: teamKeyFromName(p.team), color: TEAMC[p.team], position: p.lead ? 'lead' : 'member', primary: true })

/** The Directory's People list, as an Admin sees it. */
export function directoryPeopleSample(): PersonView[] {
  return PEOPLE.map(p => ({
    id: p.id, full_name: p.name, avatarUrl: null, title: p.title,
    teamId: `t-${p.team}`, teamName: p.team, teamKey: teamKeyFromName(p.team), color: TEAMC[p.team], teams: [teamOf(p)],
    manager_id: p.manager, managerName: nameOf(p.manager), alsoReportsToId: null, alsoReportsToName: null,
    employmentType: p.type, schedule: p.schedule, weeklyHours: p.hours, hireDate: p.hire,
    roleType: p.level, status: 'active' as const,
    emails: { trueNorth: email(p, TN), goodnews: p.id === 'p-ben' ? null : email(p, GN), coe: null },
    accountId: p.account ? `acct-${p.id}` : null, accountEmail: p.account ? email(p, GN) : null,
    hasTsheets: p.id !== 'p-ben', lastAccessAt: p.lastAccess, portalInvitedAt: p.invited,
    twoStepSince: p.account ? p.twoStep : undefined,
  })).sort((a, b) => a.full_name.localeCompare(b.full_name))
}

export const directoryTeamOptions: TeamOption[] = Object.keys(TEAMC).map(n => ({ id: `t-${n}`, name: n, key: teamKeyFromName(n), color: TEAMC[n] }))

/** What an Admin's access opens around the cards. */
export const adminCardRights: CardRights = { rates: false, accessLog: true, portal: true, invite: true, resetTwoStep: false, edit: true, positions: false, work: true }

/** Two-step sign-in by person, for the Portal access tab. */
export function twoStepSample(): Record<string, 'on' | 'none'> {
  return Object.fromEntries(PEOPLE.filter(p => p.account).map(p => [p.id, p.twoStep ? 'on' as const : 'none' as const]))
}

/** Who looks at Alex Rivera's page: Alex, Jordan (Alex's Team Leader) or an Admin. */
export type PageViewer = 'own' | 'lead' | 'admin'

/** Alex Rivera's page, with only the tabs the viewer opens filled in, as the server does. */
export function personPageSample(viewer: PageViewer): PersonPageData {
  const p = byId.get('p-alex')!
  const rel: Relation = viewer === 'own' ? 'own' : viewer === 'lead' ? 'led' : 'other'
  const rights = pageRights(canAs(viewer === 'admin' ? 'admin' : viewer === 'lead' ? 'team_leader' : 'user'), rel)!
  const t = tenureSince(p.hire, NOW)
  const teams: PageTeam[] = [{ teamId: 't-Writers', teamName: 'Writers', color: TEAMC.Writers, position: 'member', primary: true }]
  return {
    id: p.id, name: p.name, title: p.title, avatarUrl: null, color: TEAMC.Writers, active: true, rights,
    cover: {
      teams, hireDate: p.hire,
      tenure: { text: formatTenure(t), milestone: milestoneOf(t), next: 'Next: 2 years this month' },
      place: rights.personal ? 'Austin, TX, United States' : null, localTime: rights.personal ? '9:00 AM' : null,
      email: !rights.own && rights.work ? email(p, GN) : null,
      whatsapp: !rights.own && rights.personal ? '15125550147' : null,
    },
    personal: rights.personal ? {
      lastName: 'Rivera', personalEmail: 'alex.rivera@example.com', phone: '+1 512 555 0147', whatsappSame: 'yes',
      dateOfBirth: '1995-04-21',
      address: { country: 'US', zip: '78701', city: 'Austin', line1: '100 Example Street', line2: null, state: 'TX' },
    } : null,
    work: rights.work ? {
      fullName: p.name, title: p.title, employmentType: p.type, schedule: p.schedule, weeklyHours: p.hours, status: 'active', accessLevel: p.level,
      emails: { trueNorth: email(p, TN), goodnews: email(p, GN), coe: null },
      teams, managerId: 'p-jordan', managerName: 'Jordan Lee', alsoReportsToId: null, alsoReportsToName: null,
      hireDate: p.hire, leftOn: null,
      milestones: [{ kind: 'joined', date: p.hire, note: 'Joined the Writers team.' }],
      history: 'Joined the Writers team in November 2024, writing articles for the client sites.',
    } : null,
    hr: rights.hr ? {
      onboarding: 'completed', offboarding: 'not_started', invitedAt: p.invited, hasAccount: true, goodnews: email(p, GN),
      twoStepSince: p.twoStep, lastAccessAt: p.lastAccess,
      lastAccessAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15', hasTsheets: true,
    } : null,
    reports: rights.reports ? [] : null,
    options: null,
    rates: null,
  }
}

/** Jordan Lee's Reports tab: the people on the Writers team. */
export function jordanReportsSample(): PersonPageData {
  const base = personPageSample('admin')
  const j = byId.get('p-jordan')!
  const t = tenureSince(j.hire, NOW)
  const writers = PEOPLE.filter(p => p.team === 'Writers' && p.id !== j.id)
  return {
    ...base, id: j.id, name: j.name, title: j.title,
    cover: { ...base.cover, hireDate: j.hire, teams: [{ teamId: 't-Writers', teamName: 'Writers', color: TEAMC.Writers, position: 'lead', primary: true }], tenure: { text: formatTenure(t), milestone: milestoneOf(t), next: 'Next: 5 years in 6 months' }, email: email(j, GN) },
    reports: [
      ...writers.map(p => ({ id: p.id, name: p.name, title: p.title, color: TEAMC.Writers, via: 'solid' as const, teamName: null, href: '/directory/p-alex' })),
      { id: 'p-ben', name: 'Ben Carter', title: 'Designer', color: TEAMC.Graphics, via: 'dotted' as const, teamName: null, href: null },
    ],
  }
}

/** The org chart: who reports to whom, with the teams each leader leads. */
export function orgSample(): OrgPerson[] {
  const card = (id: string, children: OrgPerson[] = []): OrgPerson => {
    const p = byId.get(id)!
    const members = PEOPLE.filter(x => x.team === p.team && x.id !== p.id)
    return {
      id, name: p.name, title: p.title, color: TEAMC[p.team], teams: [{ name: p.team, color: TEAMC[p.team] }],
      ledTeams: p.lead ? [{ name: p.team, color: TEAMC[p.team], members: members.map(m => ({ id: m.id, name: m.name })) }] : [],
      secondaryManagerId: null, primaryTeamName: p.team, ghosts: [], children,
    }
  }
  return [card('p-chris', [card('p-priya'), card('p-maria'), card('p-jordan', [card('p-alex')]), card('p-sam'), card('p-ben')])]
}

/** The anniversary badges, worked out from the invented start dates. */
export function anniversariesSample(): { quarters: HrSection[]; years: HrSection[]; next: HrNext } {
  const quarters: Record<number, HrHolder[]> = { 1: [], 2: [], 3: [] }
  const years = new Map<number, HrHolder[]>()
  let max = 1
  for (const p of PEOPLE) {
    const t = tenureSince(p.hire, NOW)
    const ms = milestoneOf(t)
    const h: HrHolder = { id: p.id, name: p.name, avatarUrl: null, teamName: p.team, teamKey: teamKeyFromName(p.team), color: TEAMC[p.team], tenure: formatTenureShort(t), href: null }
    if (ms.kind === 'quarter') quarters[ms.value].push(h)
    if (ms.kind === 'year') { years.set(ms.value, [...(years.get(ms.value) ?? []), h]); max = Math.max(max, ms.value) }
  }
  return {
    quarters: [1, 2, 3].map(q => ({ key: `q${q}`, milestone: { kind: 'quarter', value: q }, label: `${q * 3} months`, holders: quarters[q] })),
    years: Array.from({ length: max }, (_, i) => i + 1).map(y => ({ key: `y${y}`, milestone: { kind: 'year', value: y, color: yearColor(y) }, label: `${y} ${y === 1 ? 'year' : 'years'}`, holders: years.get(y) ?? [] })),
    next: { name: 'Alex Rivera', avatarUrl: null, color: TEAMC.Writers, years: 2, inDays: 8 },
  }
}
