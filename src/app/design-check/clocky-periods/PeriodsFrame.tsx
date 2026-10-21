// The Timesheet periods screens (Timesheet Periods.dc.html, 5A to 5C3) with the
// prototype's data, for the design check page and for the app shell check.

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

/** One frame's content: 5A settings, 5B Clarise's page, 5C Rates & Costs. */
export function PeriodsFrame({ frame, level = 'super' }: { frame: string; level?: 'super' | 'admin' }) {
  return (
    <>
      {frame.startsWith('5A') && <SettingsCheck frame={frame} level={level} />}
      {frame.startsWith('5B') && (
        <div className="space-y-4">
          <Breadcrumb parents={['/directory']} now="Clarise Nixon" />
          <PersonCheck data={clarise()} editing={frame === '5B2'} />
        </div>
      )}
      {frame.startsWith('5C') && (
        <div className="space-y-6">
          <Breadcrumb self="/directory" />
          <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] text-tn-ink m-0 leading-[normal]" style={{ letterSpacing: '-.01em' }}>Directory</h1>
          <RatesCheck frame={frame} />
        </div>
      )}
    </>
  )
}
