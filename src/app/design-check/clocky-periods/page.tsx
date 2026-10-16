// Design check: Timesheet periods (design handoff of 16 October 2026,
// Timesheet Periods.dc.html), the real screens with the prototype's data.
//
//   ?frame=5A     Company settings > Timesheet periods, reading
//   ?frame=5A2    editing, the start date moved to Thu, Oct 8: the amber line and "Move the pay periods?"
//   ?frame=5B     Clarise Nixon's page, Work tab: the Timesheet section
//   ?frame=5B2    editing it: Monthly picked, the "starts" line
//   ?frame=5C     Directory > Rates & Costs: the Timesheet column and its filter
//   ?frame=5C2    editing: two cadences changed, highlighted
//   ?frame=5C3    "Change how these people submit?"
//   ?level=admin  5A at the Admin level (read only)
//
// Nothing reads or writes the database. Development only.

import { notFound } from 'next/navigation'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { canAs } from '@/lib/access/simulate'
import { pageRights } from '@/lib/directory/page-rights'
import { nextMilestone, type PersonPageData } from '@/lib/directory/person-page-data'
import { formatTenure, milestoneOf, tenureSince } from '@/lib/tenure'
import { SettingsCheck } from './SettingsCheck'
import { PersonCheck } from './PersonCheck'
import { RatesCheck } from './RatesCheck'
import { idOf } from './sample'

/** Clarise Nixon as the prototype has her (Social Media, reports to Rock Kai, joined Aug 5, 2024). */
function clarise(): PersonPageData {
  const rights = pageRights(canAs('super_admin'), 'other')!
  const hire = '2024-08-05'
  const t = tenureSince(hire, new Date('2026-10-15T12:00:00Z'))
  const teams = [{ teamId: 't-sm', teamName: 'Social Media', color: '#DC2626', position: 'member' as const, primary: true }]
  return {
    id: idOf('Clarise Nixon'), name: 'Clarise Nixon', title: 'Social Media Specialist', avatarUrl: null, color: '#DC2626', active: true, rights,
    cover: { teams, hireDate: hire, tenure: { text: formatTenure(t), milestone: milestoneOf(t), next: nextMilestone(t) }, location: null, localTime: null, email: null, whatsapp: null },
    personal: null,
    work: {
      fullName: 'Clarise Nixon', title: 'Social Media Specialist', employmentType: 'us', schedule: 'full', weeklyHours: 40, status: 'active', accessLevel: 'user',
      emails: { trueNorth: null, goodnews: null, coe: null },
      teams, managerId: 'm1', managerName: 'Rock Kai', alsoReportsToId: null, alsoReportsToName: null,
      hireDate: hire, leftOn: null, milestones: [], history: null,
    },
    hr: null,
    reports: null,
    options: { people: [{ value: 'm1', label: 'Rock Kai' }], teams: [{ id: 't-sm', name: 'Social Media' }] },
  }
}

export const dynamic = 'force-dynamic'

export default async function ClockyPeriodsCheck({ searchParams }: { searchParams: Promise<{ frame?: string; level?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { frame = '5A', level } = await searchParams
  return (
    <div className="min-h-screen bg-background px-6 py-8">
      {frame.startsWith('5A') && <SettingsCheck frame={frame} level={level === 'admin' ? 'admin' : 'super'} />}
      {frame.startsWith('5B') && (
        <div className="space-y-4">
          <Breadcrumb parents={['/directory']} now="Clarise Nixon" />
          <PersonCheck data={clarise()} editing={frame === '5B2'} />
        </div>
      )}
      {frame.startsWith('5C') && (
        <div className="space-y-6">
          <Breadcrumb self="/directory" />
          <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">Directory</h1>
          <RatesCheck frame={frame} />
        </div>
      )}
    </div>
  )
}
