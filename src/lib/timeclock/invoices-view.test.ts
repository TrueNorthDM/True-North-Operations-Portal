import { describe, it, expect, vi } from 'vitest'

// The builders are pure; the module also reads the database for the live pages.
vi.mock('./clocky-context', () => ({ db: vi.fn(), loadDirectory: vi.fn() }))
vi.mock('./pay-terms', () => ({ isFinance: vi.fn(), loadInvoiceSettings: vi.fn(), loadRoutes: vi.fn(), seesMoney: vi.fn() }))

const { buildInvoiceDetail, buildInvoiceList } = await import('./invoices-view')
type ListSrc = Parameters<typeof buildInvoiceList>[0]
type Inv = ListSrc['invoices'][number]

const SETTINGS = { invoiceApprovers: ['ao', 'dave'], defaultApprover: 'ao', deputyDirector: 'dave' }
const NAMES: Record<string, string> = { ao: 'Arnaldo Oliveira', dave: 'Dave Sharpe', wendy: 'Wendy Cacka', sam: 'Samuel Manzi', jt: 'Justus Tsofa', tina: 'Tina Gennette' }
const route = (personId: string, reportsTo: string, paysAs: 'hourly' | 'fixed_monthly' | 'fixed_no_timesheet' = 'hourly') => ({ personId, reportsTo, isContractor: true, paysAs })
const inv = (o: Partial<Inv> & { id: number; person_id: string }): Inv => ({
  number: `INV-2026-${String(o.id).padStart(4, '0')}`, submission_id: o.id, total: 2000, kind: 'hourly', state: 'waiting',
  period_start: '2026-10-01', period_end: '2026-10-31', issued_on: '2026-11-01', due_on: '2026-11-15', created_at: '2026-11-01T07:05:00Z',
  approved_by: null, approved_at: null, paid_on: null, paid_ref: null, from_snapshot: { name: NAMES[o.person_id] }, to_snapshot: {}, ...o,
})

function list(o: Partial<ListSrc>) {
  return buildInvoiceList({
    mode: 'all', finance: false, invoices: [], rates: new Map(), subs: new Map(),
    routes: new Map([['sam', route('sam', 'wendy')], ['jt', route('jt', 'ao')]]),
    settings: SETTINGS, person: id => ({ name: NAMES[id] ?? 'Someone', team: 'Web', color: '#A99BD4' }), nameOf: id => (id ? NAMES[id] ?? 'Someone' : 'Clocky'),
    today: '2026-11-03', ...o,
  })
}

describe('the Invoices list (6E)', () => {
  it('says where each invoice is, as the prototype does', () => {
    const l = list({
      invoices: [
        inv({ id: 145, person_id: 'sam' }),
        inv({ id: 147, person_id: 'sam', submission_id: 147 }),
        inv({ id: 142, person_id: 'jt' }),
        inv({ id: 141, person_id: 'jt', state: 'approved', approved_at: '2026-11-02T14:00:00Z' }),
        inv({ id: 131, person_id: 'jt', state: 'paid', approved_at: '2026-10-02T14:00:00Z', paid_on: '2026-10-12', paid_ref: 'WISE-77310', period_start: '2026-09-01', period_end: '2026-09-30' }),
      ],
      subs: new Map([[145, { id: 145, state: 'submitted' }], [147, { id: 147, state: 'hours_approved' }], [142, { id: 142, state: 'submitted' }]]),
      rates: new Map([[142, 14]]),
    })
    const by = new Map(l.rows.map(r => [r.number, r]))
    expect(by.get('INV-2026-0145')).toMatchObject({ st: 'hrs', where: 'Hours with Wendy Cacka' })
    expect(by.get('INV-2026-0147')).toMatchObject({ st: 'wait', where: 'Hours approved · with Arnaldo Oliveira' })
    expect(by.get('INV-2026-0142')).toMatchObject({ st: 'wait', where: 'With Arnaldo Oliveira', pays: '$14.00/h' })
    expect(by.get('INV-2026-0141')).toMatchObject({ st: 'appr', where: 'Approved Nov 2, 2026' })
    expect(by.get('INV-2026-0131')).toMatchObject({ st: 'paid', where: 'Oct 12, 2026 · WISE-77310', period: 'September 2026' })
    expect(l.periods).toEqual(['October 2026', 'September 2026'])
    expect(l.defaultPeriod).toBe('October 2026')
    // "Paid in October", and clicking it shows September's invoices (the ones paid then).
    expect(l.paidMonth).toEqual({ label: 'October', ym: '2026-10' })
    expect(l.paidPeriod).toBe('September 2026')
  })

  it('offers Mark paid to Finance only, and only on approved invoices', () => {
    const rows = [inv({ id: 1, person_id: 'jt', state: 'approved' }), inv({ id: 2, person_id: 'jt' })]
    expect(list({ invoices: rows }).rows.map(r => r.canPay)).toEqual([false, false])
    expect(list({ invoices: rows, finance: true }).rows.map(r => r.canPay)).toEqual([true, false])
  })

  it('names how each one pays', () => {
    const l = list({
      invoices: [inv({ id: 1, person_id: 'jt', kind: 'fixed_monthly' }), inv({ id: 2, person_id: 'jt', kind: 'fixed_no_timesheet', submission_id: null })],
    })
    expect(l.rows.map(r => r.pays)).toEqual(['Fixed monthly', 'Fixed, no timesheet'])
    // No timesheet: one step, with its approver.
    expect(l.rows[1].where).toBe('With Arnaldo Oliveira')
  })
})

describe('one invoice (6F)', () => {
  const base = {
    lines: [{ kind: 'hours', client: '2 - i7 Marketing', description: '2 - i7 Marketing, October 2026', hours_seconds: 36000, rate: 14, amount: 140 }, { kind: 'reimbursement', client: 'Internet', description: 'Internet, October', hours_seconds: null, rate: null, amount: 35 }],
    sub: { id: 142, state: 'approved' }, route: route('jt', 'ao'), settings: SETTINGS, finance: false,
    nameOf: (id: string | null | undefined) => (id ? NAMES[id] ?? 'Someone' : 'Clocky'), zone: 'America/New_York',
  }

  it('tells its history newest first: created, the reimbursement, approved together, paid', () => {
    const d = buildInvoiceDetail({
      ...base,
      inv: inv({ id: 142, person_id: 'jt', state: 'paid', approved_at: '2026-11-03T14:40:00Z', paid_on: '2026-11-12', paid_ref: 'WISE-88412' }),
      events: [
        { step: 'both', action: 'approve', by_person: 'ao', at: '2026-11-03T14:40:00Z', note: null },
        { step: 'paid', action: 'paid', by_person: 'tina', at: '2026-11-12T15:00:00Z', note: null },
      ],
    })
    expect(d.history.map(h => h.text)).toEqual([
      'Paid on Nov 12, 2026 by Tina Gennette, ref. WISE-88412',
      'Approved by Arnaldo Oliveira, together with the hours',
      'Reimbursement added by itself: Internet, October ($35.00)',
      'Created when the October timesheet was submitted',
    ])
    expect(d.doc.paid).toBe('Paid Nov 12, 2026 · WISE-88412')
    expect(d.locked).toBe('Locked. A change means reopening the timesheet, which sends this invoice back to Draft.')
    expect(d.canPay).toBe(false)
  })

  it('says an approved invoice with no timesheet does not change', () => {
    const d = buildInvoiceDetail({ ...base, sub: undefined, inv: inv({ id: 150, person_id: 'jt', state: 'approved', kind: 'fixed_no_timesheet', submission_id: null }), events: [] })
    expect(d.locked).toBe('Locked. An approved invoice with no timesheet does not change.')
  })

  it('a return sends it back to Draft, with the reason', () => {
    const d = buildInvoiceDetail({
      ...base, sub: { id: 142, state: 'returned' },
      inv: inv({ id: 142, person_id: 'jt', state: 'draft' }),
      events: [{ step: 'both', action: 'return', by_person: 'ao', at: '2026-11-02T19:30:00Z', note: 'Oct 12 has 2 entries on DDI that belong to GNA.' }],
    })
    expect(d.st).toBe('draft')
    expect(d.history[0].text).toBe('Returned by Arnaldo Oliveira with the timesheet: "Oct 12 has 2 entries on DDI that belong to GNA." Back to Draft.')
    expect(d.locked).toBeNull()
  })

  it('Finance marks an approved one paid', () => {
    const d = buildInvoiceDetail({ ...base, finance: true, inv: inv({ id: 138, person_id: 'jt', state: 'approved', approved_at: '2026-11-02T14:00:00Z' }), events: [] })
    expect(d.canPay).toBe(true)
    expect(d.pay).toEqual({ who: 'Justus Tsofa', line: 'October 2026 · approved Nov 2, 2026', total: '$2,000.00' })
  })
})
