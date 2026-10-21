// Clocky part 2 frames inside the app shell (design handoff part 2,
// Design/design_handoff_clocky 2): each frame's content with the prototype's
// data. The codes are the overview's (Clocky parte 2 (todas as telas).dc.html).

import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { canAs } from '@/lib/access/simulate'
import { pageRights } from '@/lib/directory/page-rights'
import { nextMilestone, type PersonPageData } from '@/lib/directory/person-page-data'
import { formatTenure, milestoneOf, tenureSince } from '@/lib/tenure'
import { PersonPayCheck } from './PersonPayCheck'
import { RatesPayCheck } from './RatesPayCheck'

/** Cheyenne Wilson as the prototype has her (Writers, Writer, contractor, Los Angeles). */
function cheyenne(): PersonPageData {
  const rights = pageRights(canAs('super_admin'), 'other')!
  const hire = '2023-03-06'
  const t = tenureSince(hire, new Date('2026-11-10T12:00:00Z'))
  const teams = [{ teamId: 't-wr', teamName: 'Writers', color: '#86C06A', position: 'member' as const, primary: true }]
  return {
    id: '00000000-0000-4000-8000-0000000000c1', name: 'Cheyenne Wilson', title: 'Writer', avatarUrl: null, color: '#86C06A', active: true, rights,
    cover: { teams, hireDate: hire, tenure: { text: formatTenure(t), milestone: milestoneOf(t), next: nextMilestone(t) }, location: 'Los Angeles, California, USA', localTime: null, email: null, whatsapp: null },
    personal: null,
    work: {
      fullName: 'Cheyenne Wilson', title: 'Writer', employmentType: 'contractor', schedule: 'full', weeklyHours: null, status: 'active', accessLevel: 'user',
      emails: { trueNorth: null, goodnews: null, coe: null },
      teams, managerId: 'm-ao', managerName: 'Arnaldo Oliveira', alsoReportsToId: null, alsoReportsToName: null,
      hireDate: hire, leftOn: null, milestones: [], history: null,
    },
    hr: null,
    reports: null,
    options: { people: [{ value: 'm-ao', label: 'Arnaldo Oliveira' }], teams: [{ id: 't-wr', name: 'Writers' }] },
  }
}

/** The part 2 frames this route draws (the rest come as they are built). */
export const PART2_FRAMES = /^(10A1|10A1v|10A2|10A2v)$/

export function Part2Frame({ frame }: { frame: string }) {
  if (frame.startsWith('10A1')) {
    return (
      <div className="space-y-4">
        <Breadcrumb parents={['/directory']} now="Cheyenne Wilson" />
        <PersonPayCheck data={cheyenne()} editing={frame === '10A1'} />
      </div>
    )
  }
  if (frame.startsWith('10A2')) {
    return (
      <div className="space-y-6">
        <Breadcrumb self="/directory" />
        <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] text-tn-ink m-0 leading-[normal]" style={{ letterSpacing: '-.01em' }}>Directory</h1>
        <RatesPayCheck editing={frame === '10A2'} />
      </div>
    )
  }
  return null
}
