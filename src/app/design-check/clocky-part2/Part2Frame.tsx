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
import { ReviewCheck } from './ReviewCheck'
import { reviewFrame } from './review-sample'
import { InvoicesCheck } from './InvoicesCheck'
import { invoiceDetailFrame, invoiceListFrame, submitFrame } from './invoice-sample'
import { PaymentsCheck } from './PaymentsCheck'
import { RequestsCheck } from './RequestsCheck'
import { extraFrame, reimbursementsFrame, rmbDocFrame, rmbSheet, timeOffFrame } from './requests-sample'
import { contractorDocs, contractorPayments, employeeDocs, employeePayments, invoice0134 } from './payments-sample'

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
export const PART2_FRAMES = /^(10A1|10A1v|10A2|10A2v|6C|6Cr|6Ct|6Ci|6Ce|6Cb|6Cn|6Cd|6Cj|6Cp|6Co|6D|6Ds|6Dx|6A|6B|6Ec|6Es|6Ef|6F|6Fp|6G|10P1|10P2|10P3|7A|7Ap|7B|7D|7Dx|7E|9A|9Ap|9B|9D|9Dp|10E|10C)$/

export function Part2Frame({ frame }: { frame: string }) {
  if (frame.startsWith('10A1')) {
    return (
      <div className="space-y-4">
        <Breadcrumb parents={['/directory']} now="Cheyenne Wilson" />
        <PersonPayCheck data={cheyenne()} editing={frame === '10A1'} />
      </div>
    )
  }
  if (frame.startsWith('10P')) {
    const emp = frame === '10P2'
    const base = cheyenne()
    const data = emp ? { ...base, id: '00000000-0000-4000-8000-0000000000c2', name: 'Wendy Cacka', title: 'Web Developer', color: '#A99BD4', cover: { ...base.cover, teams: [{ teamId: 't-web', teamName: 'Web', color: '#A99BD4', position: 'lead' as const, primary: true }], location: 'Chicago, Illinois, USA' } } : base
    return (
      <div className="space-y-4">
        <Breadcrumb parents={['/directory']} now={data.name} />
        <PaymentsCheck data={data} payments={emp ? employeePayments() : contractorPayments()} open={frame === '10P3' ? invoice0134() : null} docs={emp ? employeeDocs() : {}} invoices={emp ? {} : contractorDocs()} />
      </div>
    )
  }
  if (/^7/.test(frame)) return <RequestsCheck frame={frame} timeOff={timeOffFrame(frame)} />
  if (frame === '9A' || frame === '9Ap' || frame === '9B') return <RequestsCheck frame={frame} rmb={reimbursementsFrame(frame)} />
  if (frame === '9D' || frame === '9Dp') return <RequestsCheck frame={frame} doc={rmbDocFrame()} sheet={rmbSheet()} />
  if (frame === '10E' || frame === '10C') return <RequestsCheck frame={frame} extra={extraFrame(frame)} />
  if (frame === '6A' || frame === '6B') return <InvoicesCheck frame={frame} submit={submitFrame(frame)} />
  if (frame === '6F' || frame === '6Fp') return <InvoicesCheck frame={frame} detail={invoiceDetailFrame(frame)} />
  if (/^6[EG]/.test(frame)) return <InvoicesCheck frame={frame} list={invoiceListFrame(frame)} pdf={invoiceDetailFrame(frame)} />
  if (/^6[CD]/.test(frame)) { const f = reviewFrame(frame); return <ReviewCheck frame={frame} review={f.review} tab={f.tab} day={f.day} modal={f.modal} /> }
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
