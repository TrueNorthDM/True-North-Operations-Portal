// The prototype's rows (Home Final.dc.html, C.L and C.D) per level, in the
// shape the server builds (lib/home/needs-you.ts). Monday, October 26, 10:46 AM.
// Finance (fin) is not in the prototype: its To pay rows (owner, 25 October
// 2026) are built by the same functions the server uses.
// The prototype's timesheet rows ("send") and its invoice in Requests are not
// here: the timesheet is never a row (the Pay period card owns it), and an
// invoice is not something a person asks for.

import { documentsToPayRow, invoicesToPayRow, type HomeRow, type HomeTab, type NeedsYouData, type Panel, type PanelButton } from '@/lib/home/needs-you-model'

export type Level = 'super' | 'admin' | 'lead' | 'emp' | 'con' | 'fin'
export const LEVELS: { key: Level; label: string; note: string }[] = [
  { key: 'super', label: 'Super Admin', note: 'Arnaldo Oliveira, contractor, approves invoices and decides requests.' },
  { key: 'admin', label: 'Admin', note: 'Dave Sharpe, employee, Admin access.' },
  { key: 'lead', label: 'Team Leader', note: 'Rock Kai, contractor, leads Social Media.' },
  { key: 'emp', label: 'User · employee', note: 'Tina Gennette, employee, Operations.' },
  { key: 'con', label: 'User · contractor', note: 'Cheyenne Wilson, contractor, Writers.' },
  { key: 'fin', label: 'Finance', note: 'Tina Gennette as Finance (Company settings > Invoices): pays invoices and reimbursement documents.' },
]

const LATE = (label: string, at: string) => ({ label, tone: 'late' as const, at })
const TODAY = { label: 'Today', tone: 'today' as const, at: '2026-10-26' }
const LATER = (label: string, at: string) => ({ label, tone: 'later' as const, at })

const approve = (label: string): PanelButton => ({ label, op: { do: 'approve-timesheet', id: 1 }, icon: 'check' })
const decide = (id: number): Pick<Panel, 'primary' | 'secondary'> => ({
  primary: { label: 'Approve', op: { do: 'time-off', id, decision: 'approve', cancel: false }, icon: 'check' },
  secondary: { label: 'Decline', op: { do: 'time-off', id, decision: 'deny', cancel: false }, needsReason: true },
})
const facts = (rows: [string, string][]) => rows.map(([k, v]) => ({ k, v }))

function task(key: string, title: string, board: string, due: HomeRow['due']): HomeRow {
  const sub = `My Work · ${board}`
  return {
    key, kind: 'work', title, sub, due, button: 'Open',
    panel: {
      title, sub, facts: facts([['Board', board], ['Step', 'Owner'], ['Status', 'Working on it'], ['Due', due!.label]]), note: null,
      link: { label: 'Open in My Work', href: '/my-work' },
      primary: { label: 'Open in Monday', href: 'https://monday.com', external: true, icon: 'arrow' },
      secondary: { label: 'Close' },
    },
  }
}

const mine = (key: string, title: string, sub: string, state: 'wait' | 'done', icon: 'requests' | 'clock' | 'client-reports' = 'requests'): HomeRow =>
  ({ key, kind: 'mine', title, sub, due: null, button: 'Open', panel: null, href: icon === 'clock' ? '/clocky-hours' : icon === 'client-reports' ? '/clocky-hours/invoices' : '/requests/time-off', mine: { state, icon } })

const tab = (rows: HomeRow[]): HomeTab => ({ rows, errors: [] })

const S1: HomeRow = {
  key: 's1', kind: 'system', title: 'QuickBooks Time has a warning', sub: 'The last sync finished 3 hours ago. It runs every hour.', due: LATE('Since 7:40', '2026-10-26T11:40:00Z'), button: 'Open Automations',
  panel: {
    title: 'QuickBooks Time has a warning', sub: 'The last sync finished 3 hours ago. It runs every hour.',
    facts: facts([['Service', 'QuickBooks Time'], ['Last good sync', 'Mon, 7:40 AM'], ['Schedule', 'Every hour'], ['Affects', 'Imported time entries']]),
    note: 'Clocky keeps working. Entries made in QuickBooks Time after 7:40 come in when the sync recovers.',
    link: { label: 'Open Automations', href: '/admin/automations' },
    primary: { label: 'Run checks now', op: { do: 'run-checks' }, icon: 'arrow' }, secondary: { label: 'Close' },
  },
}
const S2: HomeRow = {
  key: 's2', kind: 'approval', title: 'Samuel Manzi, Oct 12 to 25', sub: 'Wendy Cacka approved 76h 30m. Approve the invoice: $2,295.00.', due: TODAY, button: 'Approve invoice',
  panel: {
    title: 'Samuel Manzi, Oct 12 to 25', sub: 'Wendy Cacka approved 76h 30m. Approve the invoice: $2,295.00.',
    facts: facts([['Period', 'Oct 12 to 25'], ['Hours', '76h 30m'], ['Rate', '$30.00 / h'], ['Invoice', '$2,295.00'], ['Timesheet', 'Approved by Wendy Cacka, Sun 8:12 PM']]),
    note: 'No hours over the allowance. Approving sends the invoice to Finance for payment.',
    link: { label: 'Open in Approvals', href: '/clocky-hours/approvals' },
    primary: { label: 'Approve invoice', op: { do: 'approve-timesheet', id: 2 }, icon: 'check' },
    secondary: { label: 'Send back', op: { do: 'return-timesheet', id: 2 }, needsReason: true },
  },
}
const S3: HomeRow = {
  key: 's3', kind: 'request', title: 'Time off: Tina Gennette', sub: 'Vacation, Wed, Nov 25 to Fri, Nov 27. 3 days.', due: TODAY, button: 'Decide',
  panel: {
    title: 'Time off: Tina Gennette', sub: 'Vacation, Wed, Nov 25 to Fri, Nov 27. 3 days.',
    facts: facts([['Type', 'Vacation'], ['Dates', 'Wed, Nov 25 to Fri, Nov 27'], ['Working days', '3'], ['After approval', 'Rippling and the team calendar'], ['Also out', 'Nobody on Operations']]),
    note: '"Thanksgiving week with my family."', link: { label: 'Open in Approvals', href: '/clocky-hours/approvals' }, ...decide(3),
  },
}
const S4: HomeRow = {
  key: 's4', kind: 'request', title: 'Extra hours: Olivia Hale', sub: '6h over her allowance this period, for the HFA audit.', due: TODAY, button: 'Decide',
  panel: {
    title: 'Extra hours: Olivia Hale', sub: '6h over her allowance this period, for the HFA audit.',
    facts: facts([['Allowance', '80h 00m this period'], ['Logged so far', '74h 10m'], ['Asking for', '+6h 00m'], ['Reason', 'HFA audit, 40 pages'], ['Cost', '+$162.00']]),
    note: 'If declined, hours past the allowance stay on her timesheet but are not paid.', link: { label: 'Open in Approvals', href: '/clocky-hours/approvals' }, ...decide(4),
  },
}
const S7: HomeRow = {
  key: 's7', kind: 'request', title: 'Reimbursement: Justus Tsofa', sub: '$48.00, internet for October. Goes on his next invoice.', due: LATER('Fri, Oct 30', '2026-10-30'), button: 'Decide',
  panel: {
    title: 'Reimbursement: Justus Tsofa', sub: '$48.00, internet for October. Goes on his next invoice.',
    facts: facts([['Amount', '$48.00'], ['For', 'Internet, October'], ['Receipt', 'receipt-oct.pdf'], ['Paid', 'On his November invoice']]),
    note: null, link: { label: 'Open in Approvals', href: '/clocky-hours/approvals' }, ...decide(7),
  },
}
const S8: HomeRow = { key: 's8', kind: 'invoices', title: '3 fixed-pay invoices are created Nov 1', sub: 'Andressa, Yuliberth and John. They come straight to you.', due: LATER('Sun, Nov 1', '2026-11-01'), button: null, panel: null }

const A1: HomeRow = {
  key: 'a1', kind: 'system', title: 'Monday sync failed twice', sub: 'Last good sync Sun, 11:40 PM. My Work may be out of date.', due: LATE('Since 6:00', '2026-10-26T10:00:00Z'), button: 'Open Automations',
  panel: {
    title: 'Monday sync failed twice', sub: 'Last good sync Sun, 11:40 PM. My Work may be out of date.',
    facts: facts([['Service', 'Monday'], ['Last good sync', 'Sun, 11:40 PM'], ['Failed', '6:00 and 7:00 AM'], ['Error', '401 Unauthorized']]),
    note: 'The token may have expired. A Super Admin replaces it in Company settings, APIs and tokens.',
    link: { label: 'Open Automations', href: '/admin/automations' },
    primary: { label: 'Run checks now', op: { do: 'run-checks' }, icon: 'arrow' }, secondary: { label: 'Close' },
  },
}
const A2: HomeRow = {
  key: 'a2', kind: 'access', title: 'John has not accepted the invitation', sub: 'Sent Tue, Oct 20. Access level: User.', due: TODAY, button: 'Resend',
  panel: {
    title: 'John has not accepted the invitation', sub: 'Sent Tue, Oct 20. Access level: User.',
    facts: facts([['Person', 'John'], ['Team', 'Special Projects'], ['Access level', 'User'], ['Sent', 'Tue, Oct 20']]),
    note: 'The invitation never expires: its button opens the sign-in page with the address filled in.',
    link: { label: 'Open in Directory', href: '/directory' },
    primary: { label: 'Resend invitation', op: { do: 'resend-invite', id: 'john' }, icon: 'arrow' },
    secondary: { label: 'Copy link', copy: '/login?email=john%40goodnewsadvocates.org' },
  },
}
const leadRow = (key: string, title: string, sub: string, rows: [string, string][], note: string): HomeRow => ({
  key, kind: 'approval', title, sub, due: TODAY, button: 'Review hours',
  panel: {
    title, sub, facts: facts(rows), note, link: { label: 'Open in Approvals', href: '/clocky-hours/approvals' },
    primary: approve('Approve hours'), secondary: { label: 'Send back', op: { do: 'return-timesheet', id: 1 }, needsReason: true },
  },
})
const L2 = leadRow('l2', 'Clarise Nixon, Oct 12 to 25', '38h 10m, sent Sun, 6:40 PM. Arnaldo Oliveira approves the invoice after you.',
  [['Period', 'Oct 12 to 25'], ['Hours', '38h 10m'], ['Edited by hand', 'None'], ['Over the allowance', 'No'], ['After you', 'Arnaldo Oliveira, the invoice']],
  'You approve the hours. Amounts are never shown to Team Leaders.')
const L3 = leadRow('l3', 'Stephanie Aguirre, Oct 12 to 25', '40h 00m. 2 entries were edited by hand.',
  [['Period', 'Oct 12 to 25'], ['Hours', '40h 00m'], ['Edited by hand', '2 entries'], ['Over the allowance', 'No'], ['After you', 'Arnaldo Oliveira, the invoice']],
  'Oct 19: 9:00 AM to 1:00 PM added, "forgot to clock in". Oct 22: end changed from 6:40 to 5:30 PM.')

// To pay, one line each (owner, 25 October 2026): three invoices (one late,
// one due today, one later) and one reimbursement document; for Super Admins,
// Admins and Finance.
const DAY = '2026-10-26'
const usdText = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const PAY_INV = invoicesToPayRow([{ amount: 2304, dueOn: '2026-10-15' }, { amount: 2295, dueOn: '2026-10-26' }, { amount: 1920, dueOn: '2026-11-09' }], DAY, usdText)!
const PAY_DOC = documentsToPayRow([{ createdOn: '2026-10-21' }], '$86.40', DAY)!

export const SAMPLE: Record<Level, NeedsYouData> = {
  super: {
    needs: tab([S1, PAY_INV, S2, S3, S4, S7, PAY_DOC, S8]),
    work: tab([task('s5', 'HFA translation targets for November', 'Hope for Africa', LATE('Was due Fri', '2026-10-23')), task('s6', 'Sign off the i7 October report', 'i7', LATER('Wed, Oct 28', '2026-10-28'))]),
    mine: tab([]),
  },
  admin: {
    needs: tab([A1, PAY_INV, A2, PAY_DOC]),
    work: tab([task('a3', 'Q4 budget review with Arnaldo', 'Leadership', TODAY), task('a4', 'Bessemeters launch brief', 'Bessemeters', LATER('Wed, Oct 28', '2026-10-28'))]),
    mine: tab([mine('r1', 'Time off, Dec 28 to 31', 'Approved, on the team calendar', 'done')]),
  },
  lead: {
    needs: tab([L2, L3]),
    work: tab([task('l4', 'Approve the November posting calendar', 'AAAF Social', TODAY), task('l5', 'Holiday campaign assets brief', 'AAAF Social', LATER('Thu, Oct 29', '2026-10-29'))]),
    mine: tab([mine('r1', 'Extra hours for Clarise Nixon, 4h', 'Waiting on Arnaldo Oliveira', 'wait', 'clock')]),
  },
  emp: {
    needs: tab([]),
    work: tab([
      task('e1', 'Send Hope for Africa monthly numbers', 'Hope for Africa', LATE('Was due Fri', '2026-10-23')),
      task('e2', 'Update the October publishing tracker', 'Operations', TODAY),
      task('e3', 'Prepare the i7 invoice backup', 'i7', TODAY),
      task('e5', 'Board cleanup: Bessemeters', 'Bessemeters', LATER('Fri, Oct 30', '2026-10-30')),
    ]),
    mine: tab([mine('r1', 'Time off, Nov 25 to 27', 'Waiting on Arnaldo Oliveira', 'wait'), mine('r2', 'Reimbursement, $32.00', 'Approved, paid on Nov 6', 'done', 'client-reports')]),
  },
  con: {
    needs: tab([]),
    work: tab([
      task('c2', 'AAAF article: questions about the Sabbath, draft', 'AAAF Writers', TODAY),
      task('c3', 'Edit 3 translated posts', 'AAAF Translation', TODAY),
      task('c4', 'HFA donor story', 'Hope for Africa', LATER('Thu, Oct 29', '2026-10-29')),
    ]),
    mine: tab([mine('r1', 'Extra hours, 5h', 'Waiting on Arnaldo Oliveira', 'wait', 'clock')]),
  },
  fin: {
    // Sorted as the server sorts them (byDue): late, today, later.
    needs: tab([PAY_INV, PAY_DOC]),
    work: tab([task('f1', 'Update the October publishing tracker', 'Operations', TODAY)]),
    mine: tab([mine('r1', 'Time off, Nov 25 to 27', 'Waiting on Arnaldo Oliveira', 'wait')]),
    today: DAY,
  },
}

/** A read that failed, as the card shows it: ?error=1. */
export function withError(d: NeedsYouData): NeedsYouData {
  return { ...d, needs: { ...d.needs, errors: [{ text: 'Approvals could not be read just now. Open Approvals to try again.', href: '/clocky-hours/approvals' }] } }
}
