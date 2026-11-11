import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, type Before } from '@/lib/timeclock/reimbursement-fake-db.test-util'
import { RMB_CHANGED, rmbVersion } from '@/lib/timeclock/reimbursement-reports'

// Approvals' reimbursement decisions and the invoice check (audit, 5 November 2026): tied to the version the
// decider saw, only by who sees the person's money, and never passed on an invoice check nobody could read.

let fake = fakeDb({})
let canMoney = true
let finance: string[] = []
const route = { personId: 'ana', isContractor: true, paysAs: 'hourly', reportsTo: 'dave' }

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/auth/view-as-server', () => ({ getViewAs: async () => null }))
vi.mock('@/lib/timeclock/north-time-lock', () => ({ closedRefusal: async () => null }))
vi.mock('@/lib/access/resolve', () => ({ loadAccess: async () => ({}), writerAccess: async () => ({ can: () => true }) }))
vi.mock('@/lib/timeclock/clocky-context', () => ({
  db: () => fake.client,
  loadCatalog: async () => ({ jobs: new Map() }),
  loadDirectory: async () => ({ nameOf: () => 'Ana Lopez', people: new Map(), teams: new Map() }),
  viewerFor: async () => ({ personId: 'dave', can: (k: string) => (k === 'ck-money' ? canMoney : true), isSuperAdmin: canMoney, ledTeamIds: new Set(), name: 'David Sharpe', level: 'admin', zone: 'America/New_York', leader: false }),
}))
vi.mock('@/lib/timeclock/clocky-store', () => ({ audit: vi.fn(), loadSubmissions: vi.fn(), lockOn: vi.fn(), overlapFor: vi.fn(), snapshot: vi.fn() }))
vi.mock('@/lib/timeclock/clocky-approvals', () => ({ loadApprovals: vi.fn() }))
vi.mock('@/lib/timeclock/approval-queue', () => ({ loadQueue: vi.fn() }))
vi.mock('@/lib/timeclock/clocky-notify', () => ({
  announceCorrectionDecided: vi.fn(), announceExtraDecided: vi.fn(), announceHoursApproved: vi.fn(), announceInvoiceApproved: vi.fn(),
  announceInvoiceReturned: vi.fn(), announceReimbursementDecided: vi.fn(), announceReimbursementReportDecided: vi.fn(), announceRmbReady: vi.fn(),
  announceTimeOffDecided: vi.fn(), announceTimesheetDecided: vi.fn(),
}))
vi.mock('@/lib/timeclock/pay-terms', async () => {
  const actual = await vi.importActual<typeof import('@/lib/timeclock/pay-terms')>('@/lib/timeclock/pay-terms')
  return {
    ...actual,
    loadInvoiceSettings: async () => ({ finance }),
    loadRouteSettings: async () => ({ finance }),
    loadPayTerms: async () => new Map(),
    loadRequestDeciders: async () => () => ['dave'],
    loadRoutes: async () => new Map([['ana', route]]),
  }
})
vi.mock('@/lib/timeclock/routing', async () => {
  const actual = await vi.importActual<typeof import('@/lib/timeclock/routing')>('@/lib/timeclock/routing')
  return { ...actual, currentStep: () => ({ step: 'invoice', owner: 'dave' }), stateAfterApprove: () => 'approved', loneInvoiceApprover: () => 'dave', invoiceApprover: () => 'dave' }
})
vi.mock('@/lib/invoice-form/data', () => ({ tellFormSender: vi.fn() }))
vi.mock('@/lib/timeclock/invoices-data', () => ({ hoursByClient: async () => [] }))
const readInvoiceCheck = vi.fn()
vi.mock('@/lib/timeclock/invoice-check-data', () => ({ readInvoiceCheck: (...a: unknown[]) => readInvoiceCheck(...a) }))
vi.mock('@/lib/timeclock/allowance-data', () => ({ loadApprovedExtra: async () => () => 0 }))
vi.mock('@/lib/timeclock/allowance-limit', () => ({ limitRefusal: async () => null }))
vi.mock('@/lib/integrations/outbox', () => ({ enqueue: vi.fn(), retryJobs: vi.fn() }))

const { decideReimbursement, decideReimbursementReport, decideInvoice, approveTimesheet } = await import('./actions')

const receipt = (id: number, extra: Record<string, unknown> = {}) => ({
  id, person_id: 'ana', state: 'pending', spent_on: '2026-10-30', category: 'Software', amount: 45, currency: 'USD', purpose: 'Figma',
  client: null, billable: false, miles: null, receipt_path: `ana/${id}.pdf`, report_id: null, decided_by: null, decided_at: null, decision_note: null, document_id: null, ...extra,
})

/** Runs `edit` once, just before the first write to reimbursements: someone changing it between the read and the claim. */
const onFirstWrite = (edit: (db: Record<string, Record<string, unknown>[]>) => void): Before => {
  let done = false
  return (q, db) => { if (!done && q.table === 'reimbursements' && q.op === 'update') { done = true; edit(db) } }
}

beforeEach(() => {
  canMoney = true
  finance = []
  readInvoiceCheck.mockReset()
})

describe('decideReimbursement', () => {
  it('approves the version the card showed', async () => {
    fake = fakeDb({ reimbursements: [receipt(1)] })
    const r = await decideReimbursement({ id: 1, decision: 'approve', version: rmbVersion([receipt(1)]) })
    expect(r.ok).toBe(true)
    expect(fake.db.reimbursements[0]).toMatchObject({ state: 'approved', decided_by: 'dave' })
  })

  it('refuses when the request was edited in place since the card was opened', async () => {
    const seen = rmbVersion([receipt(1)])
    fake = fakeDb({ reimbursements: [receipt(1, { amount: 450 })] })
    expect(await decideReimbursement({ id: 1, decision: 'approve', version: seen })).toEqual({ ok: false, error: RMB_CHANGED })
    expect(fake.db.reimbursements[0].state).toBe('pending')
  })

  it('undoes the claim when an edit lands between the read and the claim', async () => {
    fake = fakeDb({ reimbursements: [receipt(1)] }, onFirstWrite(db => { db.reimbursements[0].amount = 450 }))
    expect(await decideReimbursement({ id: 1, decision: 'deny', note: 'Not ours', version: rmbVersion([receipt(1)]) })).toEqual({ ok: false, error: RMB_CHANGED })
    expect(fake.db.reimbursements[0]).toMatchObject({ state: 'pending', decided_by: null, decided_at: null, decision_note: null })
  })

  it('is refused to a decider on the list who does not see the person\'s money', async () => {
    canMoney = false
    fake = fakeDb({ reimbursements: [receipt(1)] })
    const r = await decideReimbursement({ id: 1, decision: 'approve', version: rmbVersion([receipt(1)]) })
    expect(r.ok).toBe(false)
    expect(fake.db.reimbursements[0].state).toBe('pending')
  })

  it('is open to Finance, who see everyone\'s money', async () => {
    canMoney = false
    finance = ['dave']
    fake = fakeDb({ reimbursements: [receipt(1)] })
    expect((await decideReimbursement({ id: 1, decision: 'approve', version: rmbVersion([receipt(1)]) })).ok).toBe(true)
  })
})

describe('decideReimbursementReport', () => {
  const rows = () => [receipt(1, { report_id: 7 }), receipt(2, { report_id: 7, amount: 80, purpose: 'Hotel' })]
  const all = (decision: 'approve' | 'deny') => [1, 2].map(id => ({ id, decision, note: 'No' }))

  it('decides every receipt of the version seen', async () => {
    fake = fakeDb({ reimbursements: rows(), reimbursement_reports: [{ id: 7, name: 'ASI' }] })
    const r = await decideReimbursementReport({ reportId: 7, decisions: all('approve'), version: rmbVersion(rows()) })
    expect(r.ok).toBe(true)
    expect(fake.db.reimbursements.map(x => x.state)).toEqual(['approved', 'approved'])
  })

  it('refuses when a receipt changed since the card was opened', async () => {
    const seen = rmbVersion(rows())
    const now = rows()
    now[1].purpose = 'Hotel and minibar'
    fake = fakeDb({ reimbursements: now, reimbursement_reports: [{ id: 7, name: 'ASI' }] })
    expect(await decideReimbursementReport({ reportId: 7, decisions: all('approve'), version: seen })).toEqual({ ok: false, error: RMB_CHANGED })
    expect(fake.db.reimbursements.map(x => x.state)).toEqual(['pending', 'pending'])
  })

  it('decides nothing when a receipt joins the request meanwhile', async () => {
    fake = fakeDb({ reimbursements: rows(), reimbursement_reports: [{ id: 7, name: 'ASI' }] }, onFirstWrite(db => { db.reimbursements.push(receipt(3, { report_id: 7 })) }))
    expect(await decideReimbursementReport({ reportId: 7, decisions: all('deny'), version: rmbVersion(rows()) })).toEqual({ ok: false, error: RMB_CHANGED })
    expect(fake.db.reimbursements.map(x => x.state)).toEqual(['pending', 'pending', 'pending'])
    expect(fake.db.reimbursements.every(x => x.decision_note == null)).toBe(true)
  })

  it('is refused to a decider who does not see the person\'s money', async () => {
    canMoney = false
    fake = fakeDb({ reimbursements: rows(), reimbursement_reports: [{ id: 7, name: 'ASI' }] })
    expect((await decideReimbursementReport({ reportId: 7, decisions: all('approve'), version: rmbVersion(rows()) })).ok).toBe(false)
    expect(fake.db.reimbursements.map(x => x.state)).toEqual(['pending', 'pending'])
  })
})

describe('an invoice check that could not be read is a refusal, never a pass', () => {
  const UNREAD = 'The invoice check could not be read. Try again in a moment.'

  it('decideInvoice', async () => {
    readInvoiceCheck.mockResolvedValue({ ok: true, check: null })
    fake = fakeDb({ invoices: [{ id: 5, number: 'INV-2026-150', person_id: 'ana', state: 'waiting', kind: 'fixed_no_timesheet', source: null, total: 1000, period_start: '2026-10-01', period_end: '2026-10-31' }] })
    expect(await decideInvoice({ id: 5, decision: 'approve' })).toEqual({ ok: false, error: UNREAD })
    expect(fake.db.invoices[0].state).toBe('waiting')
  })

  it('approveTimesheet', async () => {
    readInvoiceCheck.mockResolvedValue({ ok: false, error: 'boom' })
    fake = fakeDb({
      tc_submissions: [{ id: 9, person_id: 'ana', state: 'hours_approved', hours_approved_by: 'dave', tc_periods: { start_date: '2026-10-01', end_date: '2026-10-31' } }],
      invoices: [{ id: 5, number: 'INV-2026-150', total: 1000, state: 'waiting', submission_id: 9 }],
    })
    expect(await approveTimesheet({ id: 9 })).toEqual({ ok: false, error: UNREAD })
    expect(fake.db.tc_submissions[0].state).toBe('hours_approved')
  })

  it('a check that was read still decides as before', async () => {
    readInvoiceCheck.mockResolvedValue({ ok: true, check: { matches: true, summary: '' } })
    fake = fakeDb({ invoices: [{ id: 5, number: 'INV-2026-150', person_id: 'ana', state: 'waiting', kind: 'fixed_no_timesheet', source: null, total: 1000, period_start: '2026-10-01', period_end: '2026-10-31' }] })
    expect((await decideInvoice({ id: 5, decision: 'approve' })).ok).toBe(true)
    expect(fake.db.invoices[0].state).toBe('approved')
  })
})
