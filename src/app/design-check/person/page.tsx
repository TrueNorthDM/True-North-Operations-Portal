// Design check: a person's page (8 October 2026), the real component with an
// invented person. ?as=admin | self | lead, ?tab=personal | work | hr | reports.
// Nothing saves (the actions refuse: nobody is signed in). Development only.

import { notFound } from 'next/navigation'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { PersonPage } from '@/components/person/PersonPage'
import { canAs } from '@/lib/access/simulate'
import { pageRights, resolvePageTab } from '@/lib/directory/page-rights'
import { nextMilestone, type PersonPageData } from '@/lib/directory/person-page-data'
import { formatTenure, milestoneOf, tenureSince } from '@/lib/tenure'

export const dynamic = 'force-dynamic'

const TEAMS = [
  { teamId: 't-w', teamName: 'Writers', color: '#d4893a', position: 'lead' as const, primary: true },
  { teamId: 't-t', teamName: 'Translation', color: '#7a5cc8', position: 'member' as const, primary: false },
]

export default async function PersonCheck({ searchParams }: { searchParams: Promise<{ as?: string; tab?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { as = 'admin', tab } = await searchParams
  const rights = as === 'self'
    ? pageRights(canAs('user'), 'own')!
    : as === 'lead' ? pageRights(canAs('team_leader'), 'led')! : pageRights(canAs('admin'), 'other')!
  const hire = '2026-02-09'
  const t = tenureSince(hire, new Date('2026-10-08T12:00:00Z'))
  const data: PersonPageData = {
    id: '00000000-0000-4000-8000-000000000001', name: 'Maya Torres', title: 'Writer', avatarUrl: null, color: '#d4893a', active: true, rights,
    cover: {
      teams: TEAMS, hireDate: hire,
      tenure: { text: formatTenure(t), milestone: milestoneOf(t), next: nextMilestone(t) },
      location: rights.personal ? 'Orlando, Florida, USA' : null, localTime: rights.personal ? '3:12 PM' : null,
      email: !rights.own && rights.work ? 'maya@goodnewsadvocates.org' : null,
      whatsapp: !rights.own && rights.personal ? '14075550142' : null,
    },
    personal: rights.personal ? {
      lastName: 'Torres', personalEmail: 'maya.torres@example.com', phone: '+1 407 555 0142', whatsappSame: 'yes',
      dateOfBirth: '1994-03-14', location: 'Orlando, Florida, USA',
      address: { country: 'US', zip: '32801', city: 'Orlando', line1: '1200 Example Ave', line2: null, state: 'FL' },
    } : null,
    work: rights.work ? {
      fullName: 'Maya Torres', title: 'Writer', employmentType: 'us', schedule: 'full', weeklyHours: 40, status: 'active', accessLevel: 'team_leader',
      emails: { trueNorth: null, goodnews: 'maya@goodnewsadvocates.org', coe: 'maya@centerforonlineevangelism.org' },
      teams: TEAMS, managerId: 'm1', managerName: 'Jordan Ellis', alsoReportsToId: null, alsoReportsToName: null,
      hireDate: hire, leftOn: null,
      milestones: [{ kind: 'joined', date: hire, note: 'Joined as a writer for AskAnAdventistFriend.' }, { kind: 'promoted', date: '2026-06-01', note: 'Lead of Writers.' }],
      history: 'Joined as a writer for the AskAnAdventistFriend articles in February 2026. Took over as Lead of Writers in June 2026.',
    } : null,
    hr: rights.hr ? {
      onboarding: 'completed', offboarding: 'not_started', invitedAt: '2026-09-28T12:00:00Z', hasAccount: true, goodnews: 'maya@goodnewsadvocates.org',
      twoStepSince: '2026-09-30T12:00:00Z', lastAccessAt: '2026-10-07T19:12:00Z', lastAccessAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15', hasTsheets: true,
    } : null,
    reports: rights.reports ? [
      { id: 'r1', name: 'Diego Ramos', title: 'Writer', color: '#d4893a', via: 'solid', teamName: null, href: '/design-check/person?as=admin' },
      { id: 'r2', name: 'Lena Carter', title: 'Writer', color: '#d4893a', via: 'team', teamName: 'Writers', href: null },
      { id: 'r3', name: 'Sofia Nunes', title: 'Translator', color: '#7a5cc8', via: 'dotted', teamName: null, href: null },
    ] : null,
    options: rights.workEdit ? {
      people: [{ value: 'm1', label: 'Jordan Ellis' }, { value: 'm2', label: 'Casey Park' }],
      teams: [{ id: 't-w', name: 'Writers' }, { id: 't-t', name: 'Translation' }, { id: 't-s', name: 'SEO' }],
    } : null,
  }
  return (
    <div className="min-h-screen bg-background p-6 sm:p-8 space-y-4">
      {rights.own ? <Breadcrumb now="My profile" /> : <Breadcrumb parents={['/directory']} now={data.name} />}
      <PersonPage data={data} tab={resolvePageTab(tab, rights)} canRemove={as === 'admin'} />
    </div>
  )
}
