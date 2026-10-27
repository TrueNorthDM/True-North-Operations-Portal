import { describe, expect, it } from 'vitest'
import { asksForNote, byDue, dayCounts, documentsToPayRow, dueOnDay, dueSince, EMPTY_TAB, ownTimeOffShown, panelText, payDocumentRow, payInvoiceRow, tabCount, timesheetRow, uniqueErrors, unreadNeedsYou, type HomeRow } from './needs-you-model'
import type { QueueRow } from '@/lib/timeclock/approval-queue'

const row = (key: string, due: HomeRow['due'], button: string | null = 'Open', mine?: HomeRow['mine']): HomeRow =>
  ({ key, kind: mine ? 'mine' : 'work', title: key, sub: '', due, button, panel: null, mine })

describe('needs you', () => {
  it('labels a day as the prototype does', () => {
    expect(dueOnDay('2026-10-23', '2026-10-26')).toEqual({ label: 'Was due Fri', tone: 'late', at: '2026-10-23' })
    expect(dueOnDay('2026-10-12', '2026-10-26').label).toBe('Was due Oct 12')
    expect(dueOnDay('2026-10-26', '2026-10-26').label).toBe('Today')
    expect(dueOnDay('2026-10-30', '2026-10-26')).toEqual({ label: 'Fri, Oct 30', tone: 'later', at: '2026-10-30' })
  })

  it('says since when a problem runs, in the viewer\'s zone', () => {
    const now = new Date('2026-10-26T14:46:00Z')
    expect(dueSince('2026-10-26T11:40:00Z', 'America/New_York', now).label).toBe('Since 7:40')
    expect(dueSince('2026-10-23T11:40:00Z', 'America/New_York', now).label).toBe('Since Fri')
    expect(dueSince('2026-10-26T03:40:00Z', 'America/New_York', now).label).toBe('Since Sun')
    expect(dueSince('2026-10-26T03:40:00Z', 'Africa/Nairobi', now).label).toBe('Since 6:40')
  })

  it('puts late first, then today, then later', () => {
    const rows = [row('b', dueOnDay('2026-10-30', '2026-10-26')), row('a', dueOnDay('2026-10-26', '2026-10-26')), row('c', dueOnDay('2026-10-20', '2026-10-26'))]
    expect(rows.sort(byDue).map(r => r.key)).toEqual(['c', 'a', 'b'])
  })

  it('counts open rows that ask something, and waiting requests', () => {
    const today = dueOnDay('2026-10-26', '2026-10-26')
    const rows = [row('a', today), row('b', today, null), row('c', today)]
    expect(tabCount('needs', rows)).toBe(2)
    expect(tabCount('needs', rows, new Set(['a']))).toBe(1)
    expect(tabCount('mine', [row('m', null, null, { state: 'wait', icon: 'requests' }), row('n', null, null, { state: 'done', icon: 'clock' })])).toBe(1)
  })

  it('sums up the day for the banner', () => {
    const t = '2026-10-26'
    const data = {
      needs: { rows: [row('s', { label: 'Since 7:40', tone: 'late', at: t }), row('i', dueOnDay('2026-11-01', t), null)], errors: [] },
      work: { rows: [row('w1', dueOnDay(t, t)), row('w2', dueOnDay('2026-10-28', t))], errors: [] },
      mine: { rows: [], errors: [] },
    }
    expect(dayCounts(data)).toEqual({ late: 1, today: 1, week: 1 })
  })

  it('leaves out of "this week" what is due later than a week from the rows\' day', () => {
    const t = '2026-10-26'
    const data = {
      needs: { rows: [row('soon', dueOnDay('2026-11-02', t)), row('far', dueOnDay('2026-11-09', t))], errors: [] },
      work: null, mine: { rows: [], errors: [] },
    }
    expect(dayCounts(data).week).toBe(2)
    expect(dayCounts({ ...data, today: t }).week).toBe(1)
  })

  it('says what an empty tab means, tab by tab', () => {
    expect(EMPTY_TAB).toEqual({ needs: 'Nothing needs you right now.', work: 'Nothing due this week.', mine: 'No requests open.' })
  })

  it('keeps one line per failed read, and keeps its link', () => {
    expect(uniqueErrors([{ text: 'A', href: '/a' }, null, { text: 'A' }, undefined, { text: 'B' }])).toEqual([{ text: 'A', href: '/a' }, { text: 'B' }])
  })

  it('draws the card with a line, not Home\'s error page, when nothing could be read', () => {
    const d = unreadNeedsYou()
    expect(d.needs).toEqual({ rows: [], errors: [{ text: 'Needs you could not be read just now. Try again in a moment.' }] })
    expect(d.work).toBeNull()
    expect(d.mine.errors).toHaveLength(1)
  })

  it('sends a Send back reason only with Send back, and a note only with approving', () => {
    expect(panelText('reason', false, 'Wrong week')).toBe('')
    expect(panelText('reason', true, 'Wrong week')).toBe('Wrong week')
    expect(panelText('note', false, 'Agreed with Dave')).toBe('Agreed with Dave')
    expect(panelText('note', true, 'Agreed with Dave')).toBe('')
    expect(panelText(null, false, 'x')).toBe('')
  })

  it('knows when approving asks for a note', () => {
    expect(asksForNote('3h 15m over the allowance were not approved in advance. Write a note to approve.')).toBe(true)
    expect(asksForNote('Type the reason for the change first.')).toBe(false)
  })
})

describe('approval rows', () => {
  const q = (over: Partial<QueueRow>): QueueRow => ({
    key: 't1', type: 'ts', id: 1, personId: 'p', name: 'Samuel Manzi', initials: 'SM', team: null,
    main: 'October 2026 · 151h 15m', sub: 'Hours only', flag: null, why: null, asked: 'Submitted Nov 1, 9:14 AM', askedAt: '',
    ownerName: '', own: false, done: null, href: null, card: null, request: null, ...over,
  })
  const today = '2026-11-02'
  const facts = (r: HomeRow) => Object.fromEntries(r.panel!.facts.map(f => [f.k, f.v]))

  it('labels a fixed invoice as an invoice, for a Team Leader too, with no amount', () => {
    const r = timesheetRow(q({ key: 'n7', main: 'October 2026 · fixed monthly', sub: 'No timesheet', flag: { text: 'No timesheet', tone: 'neu' }, why: 'Fixed monthly, no timesheet.' }), true, today, '/a')
    expect(r.button).toBe('Approve invoice')
    expect(r.panel!.primary.label).toBe('Approve invoice')
    expect(r.panel!.primary.op).toEqual({ do: 'invoice', id: 1, decision: 'approve' })
    expect(r.sub).toBe('No timesheet')
    expect(JSON.stringify(r)).not.toMatch(/\$/)
  })

  it('a Team Leader approves the hours of a timesheet', () => {
    const r = timesheetRow(q({}), true, today, '/a')
    expect(r.button).toBe('Review hours')
    expect(r.panel!.primary.label).toBe('Approve hours')
    expect(facts(r)['Goes to']).toBeUndefined()
  })

  it('gives "Goes to" only when it names a place', () => {
    expect(facts(timesheetRow(q({}), false, today, '/a'))['Goes to']).toBeUndefined()
    expect(facts(timesheetRow(q({ key: 'n2', main: 'October 2026 · fixed monthly', sub: 'No timesheet', flag: { text: 'No timesheet', tone: 'neu' } }), false, today, '/a'))['Goes to']).toBeUndefined()
    expect(facts(timesheetRow(q({ sub: 'Payroll summary, goes to Rippling' }), false, today, '/a'))['Goes to']).toBe('Rippling')
    const money = timesheetRow(q({ sub: 'Invoice INV-2026-0143 · $3,357.50' }), false, today, '/a')
    expect(facts(money).Invoice).toBe('INV-2026-0143 · $3,357.50')
    expect(money.button).toBe('Approve invoice')
  })

  it('says a line once when the flag and the queue say the same', () => {
    const r = timesheetRow(q({ key: 'n3', main: 'October 2026 · fixed monthly', sub: 'No timesheet', flag: { text: 'No timesheet', tone: 'neu' } }), false, today, '/a')
    expect(r.sub).toBe('No timesheet')
  })
})

// Finance's To pay (owner, 25 October 2026).
describe('to pay rows', () => {
  const today = '2026-10-26'
  const facts = (r: HomeRow) => Object.fromEntries(r.panel!.facts.map(f => [f.k, f.v]))
  const inv = { id: 138, number: 'INV-2026-0138', who: 'Samuel Manzi', period: 'October 2026', total: '$2,295.00', dueOn: '2026-10-15', approvedBy: 'Dave Sharpe', approvedOn: '2026-10-24' }

  it('names an invoice to pay, dates it by its due day, and marks it paid with the form', () => {
    const r = payInvoiceRow(inv, today)
    expect(r.kind).toBe('pay')
    expect(r.title).toBe('Pay INV-2026-0138: Samuel Manzi')
    expect(r.sub).toBe('$2,295.00 · October 2026')
    expect(r.due).toEqual({ label: 'Was due Oct 15', tone: 'late', at: '2026-10-15' })
    expect(payInvoiceRow({ ...inv, dueOn: today }, today).due?.label).toBe('Today')
    expect(payInvoiceRow({ ...inv, dueOn: '2026-11-09' }, today).due?.tone).toBe('later')
    expect(r.button).toBe('Mark paid')
    expect(r.panel!.primary).toEqual({ label: 'Mark paid', op: { do: 'pay-invoice', id: 138 }, icon: 'check' })
    expect(r.panel!.secondary).toEqual({ label: 'Close' })
    expect(r.panel!.link).toEqual({ label: 'Open in Invoices', href: '/clocky-hours/invoices/138' })
    expect(r.panel!.payForm).toEqual({ paidOn: 'Oct 26, 2026', refPlaceholder: 'e.g. WISE-88412' })
    expect(facts(r)).toMatchObject({ Invoice: 'INV-2026-0138', Person: 'Samuel Manzi', Total: '$2,295.00', Approved: 'Dave Sharpe, Oct 24, 2026', Due: 'Oct 15, 2026' })
  })

  it('leaves out the approval it does not know', () => {
    expect(facts(payInvoiceRow({ ...inv, approvedBy: null, approvedOn: null }, today)).Approved).toBeUndefined()
  })

  it('names a document to pay, its items as facts, dated by the day it was made', () => {
    const r = payDocumentRow({
      id: 30, number: 'RMB-2026-0030', who: 'Dave Sharpe',
      items: [{ date: 'Oct 19', category: 'Software', purpose: 'Figma', amount: '$45.00' }, { date: 'Oct 21', category: 'Internet', purpose: 'Internet', amount: '$41.40' }],
      total: '$86.40', approvedBy: ['Arnaldo Oliveira'], createdOn: '2026-10-21',
    }, today)
    expect(r.title).toBe('Pay RMB-2026-0030: Dave Sharpe')
    expect(r.sub).toBe('$86.40 · Figma, Internet')
    expect(r.due).toEqual({ label: 'Was due Wed', tone: 'late', at: '2026-10-21' })
    expect(r.panel!.primary.op).toEqual({ do: 'pay-document', id: 30 })
    expect(r.panel!.link.href).toBe('/requests/reimbursements/30')
    expect(r.panel!.payForm?.refPlaceholder).toBe('e.g. ACH-20261103')
    expect(r.panel!.note).toBe('You are Finance. Pay Dave outside Rippling payroll, then mark it paid here.')
    expect(facts(r)).toMatchObject({ 'Oct 19, Software': '$45.00', 'Oct 21, Internet': '$41.40', Total: '$86.40', 'Approved by': 'Arnaldo Oliveira', Date: 'Oct 21, 2026' })
  })

  it('counts in its tab and in the banner, and not once paid here', () => {
    const r = payInvoiceRow(inv, today)
    expect(tabCount('needs', [r])).toBe(1)
    expect(tabCount('needs', [r], new Set([r.key]))).toBe(0)
    expect(dayCounts({ needs: { rows: [r], errors: [] }, work: null, mine: { rows: [], errors: [] }, today })).toEqual({ late: 1, today: 0, week: 0 })
  })

  it('opens the documents to pay from "Reimbursements to pay" (owner, 25 October 2026)', () => {
    const r = documentsToPayRow([{ createdOn: '2026-10-21' }, { createdOn: '2026-10-19' }], '$86.40', '2026-10-26')!
    expect(r.href).toBe('/requests/reimbursements?view=documents&state=appr')
    expect(r.sub).toBe('2 documents · waiting since Oct 19')
    expect(r.due?.tone).toBe('later')
    expect(documentsToPayRow([], '$0.00', '2026-10-26')).toBeNull()
  })

  it('keeps a cancelled time off on Requests 30 days, even when its cancellation was asked (audit, 27 October 2026)', () => {
    const since = '2026-09-27T00:00:00.000Z'
    const t = { state: 'approved', cancel_asked_at: null, decided_at: null, cancelled_at: null }
    expect(ownTimeOffShown({ ...t, state: 'pending' }, since)).toBe(true)
    expect(ownTimeOffShown({ ...t, cancel_asked_at: '2026-10-20T10:00:00Z', decided_at: '2026-05-01T10:00:00Z' }, since)).toBe(true)
    expect(ownTimeOffShown({ ...t, decided_at: '2026-10-01T10:00:00Z' }, since)).toBe(true)
    // Cancelled in May after asking: it kept cancel_asked_at, and is long done.
    expect(ownTimeOffShown({ state: 'cancelled', cancel_asked_at: '2026-05-01T10:00:00Z', decided_at: '2026-04-01T10:00:00Z', cancelled_at: '2026-05-02T10:00:00Z' }, since)).toBe(false)
    expect(ownTimeOffShown({ state: 'cancelled', cancel_asked_at: '2026-10-01T10:00:00Z', decided_at: '2026-09-01T10:00:00Z', cancelled_at: '2026-10-02T10:00:00Z' }, since)).toBe(true)
  })
})
