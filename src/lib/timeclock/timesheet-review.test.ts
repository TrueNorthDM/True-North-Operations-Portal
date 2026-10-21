import { describe, it, expect, vi } from 'vitest'

// The page builder is pure; its module also reads the database for the live
// page, which these tests never call.
vi.mock('./clocky-context', () => ({ db: vi.fn(), loadDirectory: vi.fn() }))
vi.mock('./clocky-entries', () => ({ loadPeriodViews: vi.fn() }))
vi.mock('./allowance-data', () => ({ loadApprovedExtra: vi.fn() }))
vi.mock('./invoices-data', () => ({ clientFolder: (p: string) => (p ? p.split(' › ')[0] : 'Other') }))
vi.mock('./pay-terms', () => ({
  loadInvoiceSettings: vi.fn(), loadPayTerms: vi.fn(),
  seesMoney: (a: { isAdmin: boolean; personId: string | null }, pid: string | null, s: { finance: readonly string[] }) => a.isAdmin || (!!a.personId && (a.personId === pid || s.finance.includes(a.personId))),
}))

const { buildReview } = await import('./timesheet-review')
type Src = Parameters<typeof buildReview>[0]

const NY = 'America/New_York'
const view = (date: string, h: number, client = '2 - i7 Marketing') => ({
  kind: 'clock' as const, seconds: h * 3600, date, billable: client === '1 - True North' ? 'no' : 'yes', path: `${client} › Content`, short: '',
  start: `${date}T12:00:00Z`, end: `${date}T${String(12 + h).padStart(2, '0')}:00:00Z`, activity: 'Content: Writing', company: 'True North', project: 'In-House', code: '', notes: '', autoOut: null,
})

function src(o: Partial<Src> & { me?: string; level?: Src['viewer']['level']; state?: 'submitted' | 'hours_approved' | 'approved' | 'returned'; reportsTo?: string; allowance?: number; contractor?: boolean }): Src {
  const me = o.me ?? 'ao'
  return {
    viewer: { personId: me, level: o.level ?? 'super_admin', isSuperAdmin: (o.level ?? 'super_admin') === 'super_admin', ledTeamIds: new Set(o.level === 'team_leader' ? ['web'] : []), zone: NY },
    sub: {
      id: 1, person_id: 'p', state: o.state ?? 'submitted', submitted_at: '2026-11-01T14:00:00Z', approved_at: o.state === 'approved' || o.state === 'returned' ? '2026-11-02T14:00:00Z' : null,
      approved_by: o.state === 'approved' || o.state === 'returned' ? 'ao' : null, hours_approved_at: o.state === 'hours_approved' ? '2026-11-02T13:00:00Z' : null,
      hours_approved_by: o.state === 'hours_approved' ? 'wendy' : null, note: o.state === 'returned' ? 'Oct 12 is wrong.' : null,
      tc_periods: { start_date: '2026-10-01', end_date: '2026-10-31', kind: 'month' },
    },
    inv: o.contractor === false ? null : {
      id: 9, number: 'INV-2026-0143', submission_id: 1, person_id: 'p', total: 2000, kind: 'hourly', state: 'waiting', period_start: '2026-10-01', period_end: '2026-10-31',
      issued_on: '2026-11-01', due_on: '2026-11-15', created_at: '2026-11-01T14:00:00Z', approved_by: null, approved_at: null, paid_on: null, paid_ref: null,
      from_snapshot: { name: 'Pat', location: 'US', email: 'pat@x.org' }, to_snapshot: { name: 'True North', address: 'PO Box\nUnited States', email: 'billing@x.org' },
    },
    invLines: [{ kind: 'hours', client: '2 - i7 Marketing', description: '2 - i7 Marketing, October 2026', hours_seconds: 100 * 3600, rate: 20, amount: 2000 }],
    prev: [], rmb: 0,
    settings: { invoiceApprovers: ['ao', 'dave'], defaultApprover: 'ao', deputyDirector: 'dave', finance: ['tina'] },
    terms: {
      paysAs: o.contractor === false ? null : 'hourly', hourlyRate: 20, fixedAmount: null, allowance: o.allowance ? { hours: o.allowance, period: 'month' } : null,
      route: { personId: 'p', reportsTo: o.reportsTo ?? 'ao', isContractor: o.contractor !== false, paysAs: o.contractor === false ? null : 'hourly' },
    },
    person: { name: 'Pat Doe', teamId: 'web', team: { name: 'Web', color: '#A99BD4' }, zone: NY },
    names: { ao: 'Arnaldo Oliveira', dave: 'Dave Sharpe', wendy: 'Wendy Cacka', p: 'Pat Doe' },
    views: ['05', '06', '07', '08', '09', '12', '13', '14', '15', '16'].map(d => view(`2026-10-${d}`, 10)),
    extraHours: 0, job: null, now: new Date('2026-11-03T14:32:00Z'),
    ...o,
  }
}

describe('the 6C page (buildReview)', () => {
  it('one step for the invoice approver: Approve both, with the invoice', () => {
    const r = buildReview(src({}))!
    expect(r.act.kind).toBe('both')
    expect(r.act.label).toBe('Approve both')
    expect(r.invoice?.number).toBe('INV-2026-0143')
    expect(r.steps).toHaveLength(1)
  })

  it('a Team Leader approves the hours and never sees money', () => {
    const r = buildReview(src({ me: 'wendy', level: 'team_leader', reportsTo: 'wendy' }))!
    expect(r.act.kind).toBe('hours')
    expect(r.act.label).toBe('Approve hours')
    expect(r.invoice).toBeNull()
    expect(r.previous).toBeNull()
    expect(r.cadenceLine).not.toMatch(/\$/)
    expect(r.steps.map(s => s.label)).toEqual(['Hours · Wendy Cacka', 'Then · Arnaldo Oliveira'])
  })

  it('after the hours, the invoice is the invoice approver\'s', () => {
    const r = buildReview(src({ reportsTo: 'wendy', state: 'hours_approved' }))!
    expect(r.act.kind).toBe('invoice')
    expect(r.act.barNote).toMatch(/^Wendy Cacka approved the hours/)
    expect(r.steps[0].state).toBe('done')
    expect(r.steps[1].state).toBe('now')
  })

  it('someone who is not the owner of the step reads it only', () => {
    const r = buildReview(src({ me: 'dave', level: 'admin' }))!
    expect(r.act.kind).toBeNull()
    expect(r.readOnly).toBe('Read only. Hours and invoice: Arnaldo Oliveira.')
  })

  it('over the allowance, the invoice approver needs a note', () => {
    const r = buildReview(src({ allowance: 90 }))!
    expect(r.act.overWarn).toBe('10h 00m over the allowance were not approved in advance. Approve still works, with a note.')
    expect(r.attention[0].text).toBe('10h 00m over the allowance without advance approval.')
    expect(r.allowance?.over).toBe('10h 00m')
  })

  it('returned: the banner says so and nothing waits', () => {
    const r = buildReview(src({ state: 'returned' }))!
    expect(r.act.kind).toBeNull()
    expect(r.result?.tone).toBe('bad')
    expect(r.result?.text).toMatch(/"Oct 12 is wrong."/)
  })

  it('an employee: payroll summary, Rippling refused shows Try again', () => {
    const r = buildReview(src({ contractor: false, state: 'approved', job: { state: 'failed', last_error: 'No pay schedule.', done_at: null } }))!
    expect(r.payroll?.rip.tone).toBe('bad')
    expect(r.result?.retry).toBe(true)
    expect(r.invoice).toBeNull()
  })
})
