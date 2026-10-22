// The Payments tab with the prototype's data (Company Settings.dc.html PAY:
// Cheyenne Wilson, contractor; Wendy Cacka, employee), built through the real
// buildContractorPayments and buildEmployeePayments. "Now" is Nov 3, 2026.

import { invoiceDocOf, type InvRow, type InvoiceDocView, type LineRow } from '@/lib/timeclock/invoice-doc'
import { buildContractorPayments, buildEmployeePayments, type PaymentsData } from '@/lib/timeclock/payments-view'
import { payrollDocOf, rmbDocOf, type DocKind, type DocSheetData } from '@/lib/timeclock/pay-docs'

const MONTH: Record<string, string> = { October: '10', September: '09', August: '08', July: '07' }
const SETTINGS = { invoiceApprovers: ['Arnaldo Oliveira', 'Dave Sharpe'], defaultApprover: 'Arnaldo Oliveira', deputyDirector: 'Dave Sharpe' }

// no, period, minutes, total, state, paid (date · ref), lines by client
const CW: [string, string, number, number, 'wait' | 'paid', string, [string, number][]][] = [
  ['INV-2026-0143', 'October 2026', 9075, 3357.5, 'wait', '', [['2 - i7 Marketing', 5760], ['1 - True North', 2475], ['Adventist Messengers/HFA', 840]]],
  ['INV-2026-0134', 'September 2026', 8400, 3080, 'paid', '2026-10-12 · WISE-77390', [['2 - i7 Marketing', 5280], ['1 - True North', 2400], ['Adventist Messengers/HFA', 720]]],
  ['INV-2026-0122', 'August 2026', 8160, 2992, 'paid', '2026-09-11 · WISE-70301', [['2 - i7 Marketing', 5040], ['1 - True North', 2400], ['Adventist Messengers/HFA', 720]]],
  ['INV-2026-0110', 'July 2026', 8310, 3047, 'paid', '2026-08-12 · WISE-64190', [['2 - i7 Marketing', 5190], ['1 - True North', 2400], ['Adventist Messengers/HFA', 720]]],
]

function inv(r: (typeof CW)[number]): InvRow {
  const [no, per, , total, st, paid] = r
  const m = MONTH[per.split(' ')[0]], start = `2026-${m}-01`
  const end = new Date(Date.UTC(2026, Number(m), 0)).toISOString().slice(0, 10)
  const next = new Date(Date.UTC(2026, Number(m), 1)).toISOString().slice(0, 10)
  const [on, ref] = paid ? paid.split(' · ') : [null, null]
  return {
    id: Number(no.slice(-4)), number: no, submission_id: Number(no.slice(-4)), person_id: 'cw', total, kind: 'hourly', state: st === 'paid' ? 'paid' : 'waiting',
    period_start: start, period_end: end, issued_on: next, due_on: new Date(Date.UTC(2026, Number(m), 15)).toISOString().slice(0, 10), created_at: `${next}T12:00:00Z`,
    approved_by: st === 'paid' ? 'Arnaldo Oliveira' : null, approved_at: st === 'paid' ? `${next}T14:00:00Z` : null, paid_on: on, paid_ref: ref,
    from_snapshot: { name: 'Cheyenne Wilson', location: 'United States', email: 'cheyenne.wilson@email.com' },
    to_snapshot: { name: 'True North Digital Marketing LLC', address: 'PO Box 2096, New York, NY 10163\nUnited States', email: 'billing@truenorthdm.org' },
  }
}

export function contractorPayments(): PaymentsData {
  return buildContractorPayments({
    name: 'Cheyenne Wilson', route: { personId: 'cw', reportsTo: 'Arnaldo Oliveira', isContractor: true, paysAs: 'hourly' }, settings: SETTINGS,
    nameOf: id => id ?? 'North Time', today: '2026-11-03',
    invoices: CW.map(r => ({ ...inv(r), seconds: r[2] * 60, subState: r[4] === 'paid' ? 'approved' : 'submitted' })),
    reimbursements: [{ id: 1, purpose: 'Grammarly Premium, October', spent_on: '2026-10-28', category: 'Software', amount: 30, state: 'on_invoice', decision_note: null, invoice_id: 143 }],
  })
}

export function employeePayments(): PaymentsData {
  const p = (id: number, start: string, end: string, w: [number, number][], state: string, offText: string, at: string | null) =>
    ({ id, start, end, state, worked: w.reduce((n, x) => n + x[0] * 60, 0), off: w.reduce((n, x) => n + x[1] * 60, 0), offText, sent: at ? { at, state: 'done', error: null } : undefined })
  return buildEmployeePayments({
    name: 'Wendy Cacka', zone: 'America/New_York', hoursBy: 'Arnaldo Oliveira',
    periods: [
      p(4, '2026-10-04', '2026-10-17', [[2640, 0], [2160, 480]], 'submitted', 'Vacation, Fri, Oct 16', null),
      p(3, '2026-09-20', '2026-10-03', [[2400, 0], [2400, 0]], 'approved', '', 'Oct 5, 2026, 9:40 AM'),
      p(2, '2026-09-06', '2026-09-19', [[1920, 480], [2400, 0]], 'approved', 'Holiday, Mon, Sep 7 (Labor Day)', 'Sep 21, 2026, 10:05 AM'),
      p(1, '2026-08-23', '2026-09-05', [[2400, 0], [2400, 0]], 'approved', '', 'Sep 8, 2026, 9:15 AM'),
    ],
    docs: [
      { id: 31, number: 'RMB-2026-0031', created_at: '2026-11-03T15:00:00Z', total: 57.99, state: 'approved', paid_on: null, paid_ref: null, items: 2 },
      { id: 19, number: 'RMB-2026-0019', created_at: '2026-08-10T15:00:00Z', total: 24, state: 'paid', paid_on: '2026-08-14', paid_ref: 'ACH-20260814', items: 1 },
    ],
  })
}

/** Cheyenne's invoices as documents (the prototype's docOf draws them at $22.00 an hour, with the reimbursement on October's). */
export function contractorDocs(): Record<number, InvoiceDocView> {
  return Object.fromEntries(CW.map(r => {
    const lines: LineRow[] = r[6].map(([c, m]) => ({ kind: 'hours', client: c, description: `${c}, ${r[1]}`, hours_seconds: m * 60, rate: 22, amount: m / 60 * 22 }))
    if (r[0] === 'INV-2026-0143') lines.push({ kind: 'reimbursement', client: 'Software', description: 'Grammarly Premium, October', hours_seconds: null, rate: null, amount: 30 })
    const doc = invoiceDocOf(inv(r), lines, r[1])
    return [doc.id, doc]
  }))
}

/** 10P-3: INV-2026-0134 in the preview window. */
export const invoice0134 = (): InvoiceDocView => contractorDocs()[134]

/** 10P-2's documents: Wendy Cacka's pay periods and reimbursement documents (Company Settings.dc.html docOf). */
export function employeeDocs(): Record<string, DocSheetData> {
  const pr = (start: string, end: string, w: [number, number][], submitted: string, sent: string | null) =>
    payrollDocOf({ name: 'Wendy Cacka', team: 'Web', start, end, submittedOn: submitted, weeks: w.map(([a, b]) => ({ worked: a * 60, off: b * 60 })), sentAt: sent })
  const billing = { name: 'True North Digital Marketing LLC', address: 'PO Box 2096, New York, NY 10163\nUnited States' }
  return {
    'payroll:4': pr('2026-10-04', '2026-10-17', [[2640, 0], [2160, 480]], '2026-10-17', null),
    'payroll:3': pr('2026-09-20', '2026-10-03', [[2400, 0], [2400, 0]], '2026-10-03', 'Oct 5, 2026, 9:40 AM'),
    'payroll:2': pr('2026-09-06', '2026-09-19', [[1920, 480], [2400, 0]], '2026-09-19', 'Sep 21, 2026, 10:05 AM'),
    'payroll:1': pr('2026-08-23', '2026-09-05', [[2400, 0], [2400, 0]], '2026-09-05', 'Sep 8, 2026, 9:15 AM'),
    'rmb:31': rmbDocOf({ number: 'RMB-2026-0031', name: 'Wendy Cacka', team: 'Web', createdOn: '2026-11-03', billing, paid: null, items: [{ spentOn: '2026-10-19', category: 'Equipment', purpose: 'USB-C hub for a second monitor', amount: 12.99 }, { spentOn: '2026-10-30', category: 'Software', purpose: 'Figma Professional, Oct to Dec', amount: 45 }] }),
    'rmb:19': rmbDocOf({ number: 'RMB-2026-0019', name: 'Wendy Cacka', team: 'Web', createdOn: '2026-08-10', billing, paid: { on: '2026-08-14', ref: 'ACH-20260814' }, items: [{ spentOn: '2026-08-03', category: 'Software', purpose: 'Zoom Pro, July', amount: 24 }] }),
  } satisfies Record<`${DocKind}:${number}`, DocSheetData>
}
