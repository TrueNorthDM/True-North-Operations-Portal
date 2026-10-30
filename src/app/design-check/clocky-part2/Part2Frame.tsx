// Clocky part 2 frames inside the app shell (design handoff part 2,
// Design/design_handoff_clocky 2): each frame's content with the prototype's
// data. The codes are the overview's (Clocky parte 2 (todas as telas).dc.html).

import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { canAs } from '@/lib/access/simulate'
import { pageRights } from '@/lib/directory/page-rights'
import { nextMilestone, type PersonPageData } from '@/lib/directory/person-page-data'
import { formatTenure, milestoneOf, tenureSince } from '@/lib/tenure'
import { PersonPayCheck } from './PersonPayCheck'
import { SettingsCheck } from './SettingsCheck'
import { typeChangeOptions } from '@/lib/timeclock/type-change'
import { RatesPayCheck } from './RatesPayCheck'
import { ReviewCheck } from './ReviewCheck'
import { reviewFrame } from './review-sample'
import { InvoicesCheck } from './InvoicesCheck'
import { invoiceDetailFrame, invoiceListFrame, submitFrame } from './invoice-sample'
import { PaymentsCheck } from './PaymentsCheck'
import { RequestsCheck } from './RequestsCheck'
import { AgendaCheck } from './AgendaCheck'
import { CatalogueCheck } from './CatalogueCheck'
import { ReportsCheck } from './ReportsCheck'
import { reportFrame } from './report-sample'
import { catalogueFrame, catalogueStartId, guideFrame } from './catalogue-sample'
import { agendaFrame, thisWeekFrame } from './agenda-sample'
import { extraFrame, reimbursementsFrame, rmbDocFrame, rmbDocsFrame, rmbSheet, timeOffFrame } from './requests-sample'
import { contractorDocs, contractorPayments, employeeDocs, employeePayments, invoice0134 } from './payments-sample'

/** Cheyenne Wilson as the prototype has her (Writers, Writer, contractor, Los Angeles). */
function cheyenne(): PersonPageData {
  const rights = pageRights(canAs('super_admin'), 'other')!
  const hire = '2023-03-06'
  const t = tenureSince(hire, new Date('2026-11-10T12:00:00Z'))
  const teams = [{ teamId: 't-wr', teamName: 'Writers', color: '#86C06A', position: 'member' as const, primary: true }]
  return {
    id: '00000000-0000-4000-8000-0000000000c1', name: 'Cheyenne Wilson', title: 'Writer', avatarUrl: null, color: '#86C06A', active: true, rights, rates: null,
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
export const PART2_FRAMES = /^(10A1|10A1v|10A2|10A2v|6C|6Cr|6Ct|6Ci|6Ce|6Cb|6Cn|6Cd|6Cj|6Cp|6Co|6D|6Ds|6Dx|6A|6B|6Ec|6Es|6Ef|6F|6Fp|6G|10P1|10P2|10P3|10A3|10A4|13A|13B|13C|7A|7Ap|7B|7D|7Dx|7E|9A|9Ap|9Ar|9B|9Br|9Be|9D|9Dp|9L|9La|9Lm|10E|10C|8A|8B|8C|8D1|8D2|8D3|8D4|8D5|8D6|8E|8E2|8F|11A|11B|11Cl|11D|12A|12B|12C|12U)$/

export function Part2Frame({ frame }: { frame: string }) {
  if (frame === '8F') return <AgendaCheck week={thisWeekFrame()} />
  if (/^12/.test(frame)) return <ReportsCheck page={reportFrame(frame)} pdf={frame === '12C'} />
  if (frame === '11D') return <CatalogueCheck frame={frame} guide={guideFrame()} />
  if (/^11/.test(frame)) return <CatalogueCheck frame={frame} data={catalogueFrame()} startId={catalogueStartId()} />
  if (/^8/.test(frame)) return <AgendaCheck data={agendaFrame(frame)} />
  if (/^13[ABC]$/.test(frame)) {
    return <SettingsCheck frame={frame} invoices={{
      prefix: 'INV', nextNumber: '0150', rmbPrefix: 'RMB', nextInvoice: 'INV-2026-0150', nextRmb: 'RMB-2026-0032',
      approvers: [{ name: 'Arnaldo Oliveira', who: 'Everyone, except the people who report to Dave Sharpe' }, { name: 'Dave Sharpe', who: 'The people who report to him, Arnaldo Oliveira included' }],
      billing: { name: 'True North Digital Marketing LLC', address: 'PO Box 2096, New York, NY 10163', country: 'United States', email: 'billing@truenorthdm.org' }, paymentDays: 14, mileageRate: 0.76,
    }} integrations={{
      rippling: { tokenSaved: true, tokenEnd: '9f2c', who: "Token saved by Arnaldo Oliveira, Sep 30, 2026. Nothing is sent until the portal's Rippling calls are written.",
        facts: [{ k: 'Sends', v: 'Approved PTO, and approved employee hours by day' }, { k: 'Reads', v: 'PTO balances (Vacation, Sick, Holiday)' }, { k: 'Waiting to send', v: '2 items, sent by themselves once it works' }],
        errors: [{ id: 1, when: 'Nov 2, 11:18 AM', what: 'Time off', text: 'Dave Sharpe, Sick, Thu, Oct 29: "Sick balance is 0h."', failed: true, doneText: null }, { id: 2, when: 'Oct 19, 9:58 AM', what: 'Hours', text: 'Wendy Cacka, Oct 4 to 17: "No pay schedule for Oct 4 to 17."', failed: false, doneText: 'Sent Oct 19, 10:02 AM' }] },
      google: { connected: true, saved: true, account: 'calendar@truenorthdm.org', who: 'Connected as calendar@truenorthdm.org by Arnaldo Oliveira, Sep 30, 2026.',
        teamCalendarId: 'c_truenorth.team@group.calendar.google.com',
        facts: [{ k: 'Last sync', v: 'Nov 3, 9:15 AM: 3 PTO events written today' }, { k: 'Writes', v: 'Approved PTO ("Name: Time off") and events marked for the team calendar' }], errors: [] },
    }} />
  }
  if (frame === '10A3' || frame === '10A4') {
    // Rock Kai, Social Media, contractor, reports to Dave Sharpe (Company Settings.dc.html 10A-3, 10A-4).
    const base = cheyenne()
    const teams = [{ teamId: 't-sm', teamName: 'Social Media', color: '#DC2626', position: 'lead' as const, primary: true }]
    const rock = { ...base, id: '00000000-0000-4000-8000-0000000000c3', name: 'Rock Kai', title: 'Team Leader', color: '#DC2626', cover: { ...base.cover, teams, location: 'United States' }, work: base.work && { ...base.work, fullName: 'Rock Kai', title: 'Team Leader', teams, managerId: 'm-ds', managerName: 'Dave Sharpe' } }
    // His own approvals and pay, as the prototype draws them: Dave Sharpe for both, $20.00/h, no allowance.
    // 10A-4: the change scheduled for Dec 1.
    const sched = frame === '10A4'
    const rockPay = {
      approvals: {
        rows: [
          { k: 'Reports to', v: 'Dave Sharpe', sub: 'Work tab' },
          { k: 'Hours approved by', v: 'Dave Sharpe', sub: 'The person they report to' },
          { k: sched ? 'Invoice, until Nov 30' : 'Invoice approved by', v: 'Dave Sharpe', sub: 'They report to Dave Sharpe' },
        ],
        note: sched ? 'From Dec 1 no invoice: Dave Sharpe approves the hours and they go to Rippling.' : 'Same person: one step, Approve both.',
      },
      pay: { isContractor: true, paysAs: 'hourly' as const, hourlyRate: 20, fixedAmount: null, allowance: null, timeOff: sched ? 'From Dec 1, in Requests' : 'Contractors do not ask PTO', contractorUntil: sched ? 'Nov 30' : null, canEdit: true },
      invoicesLine: sched ? 'Last one: November 2026' : 'Made when they submit',
      scheduled: sched,
    }
    const options = typeChangeOptions('2026-11-03', '2026-10-04', 'Dave Sharpe')
    return (
      <div className="space-y-4">
        <Breadcrumb parents={['/directory']} now="Rock Kai" />
        <PersonPayCheck data={rock} editing={false} sample={rockPay} typeChange={{
          name: 'Rock Kai', canMigrate: frame === '10A3', canCancel: frame === '10A4', options, startOpen: frame === '10A3',
          scheduled: frame === '10A4' ? { date: 'Tue, Dec 1, 2026', text: 'November closes as a contractor, with their last invoice; then pay periods and Rippling. It goes in their history on the day.' } : null,
          stays: "Reports to Dave Sharpe, who keeps approving Rock's hours. Their team, their allowance, their time entries and every past invoice and decision.",
          rippling: 'none',
        }} />
      </div>
    )
  }
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
  if (frame === '9A' || frame === '9Ap' || frame === '9Ar' || frame === '9B' || frame === '9Br' || frame === '9Be') return <RequestsCheck frame={frame} rmb={reimbursementsFrame(frame)} />
  if (frame === '9L' || frame === '9La' || frame === '9Lm') return <RequestsCheck frame={frame} rmb={rmbDocsFrame(frame)} />
  if (frame === '9D' || frame === '9Dp') return <RequestsCheck frame={frame} doc={rmbDocFrame()} sheet={rmbSheet()} />
  if (frame === '10E' || frame === '10C') return <RequestsCheck frame={frame} extra={extraFrame(frame)} />
  if (frame === '6A' || frame === '6B') return <InvoicesCheck frame={frame} submit={submitFrame(frame)} />
  if (frame === '6F' || frame === '6Fp') return <InvoicesCheck frame={frame} detail={invoiceDetailFrame(frame)} />
  if (/^6[EG]/.test(frame)) return <InvoicesCheck frame={frame} list={invoiceListFrame(frame)} pdf={invoiceDetailFrame(frame)} />
  if (/^6[CD]/.test(frame)) { const f = reviewFrame(frame); return <ReviewCheck frame={frame} review={f.review} tab={f.tab} day={f.day} modal={f.modal} /> }
  if (frame.startsWith('10A2')) {
    return (
      <RatesPayCheck editing={frame === '10A2'} />
    )
  }
  return null
}
