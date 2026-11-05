import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeDb, type Fake } from '@/lib/directory/__fakes__/db'

// The invoice form on the server (audit, 5 November 2026): one invoice a
// person a month across the form and the portal, and a returned invoice sent
// again either all saved or put back as it was.

let fake: Fake
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => withIlike(fake.db), createUploadClient: () => fake.db }))
vi.mock('@/lib/email/resend', () => ({ sendEmail: async () => ({ sent: true }) }))
vi.mock('@/lib/timeclock/clocky-notify', () => ({ announceTimesheetSubmitted: async () => {}, portalOrigin: async () => 'https://portal.test' }))
vi.mock('@/lib/timeclock/pay-terms', () => ({
  loadInvoiceSettings: async () => ({ paymentDays: 15, billingName: 'True North', billingAddress: '', billingEmail: 'finance@example.com' }),
  loadRouteSettings: async () => ({}), loadRoutes: async () => new Map(),
}))

const { monthFor, linkSubmission, writeFormInvoice } = await import('./data')

type Q = Record<string, (...a: unknown[]) => unknown>
/** The fake has no ilike: here it filters nothing (the tests keep no submissions waiting). */
function withIlike(db: never): never {
  const d = db as unknown as { from: (t: string) => Q }
  return { ...d, from: (t: string) => { const q = d.from(t); q.ilike = () => q; return q } } as never
}
/** The next delete on a table fails, as a lost connection would. */
function failNextDelete(table: string) {
  const d = fake.db as unknown as { from: (t: string) => Q }
  const from = d.from
  let failed = false
  d.from = (t: string) => {
    const q = from(t)
    if (t === table && !failed) {
      const del = q.delete
      q.delete = () => { failed = true; del(); q.then = ((ok: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'boom' } }).then(ok)) as never; return q }
    }
    return q
  }
}

const ME = 'jo'
const portal = (over: Record<string, unknown>) => ({ person_id: ME, source: null, kind: 'hourly', submission_id: 7, number: 'INV-0009', ...over })

beforeEach(() => {
  fake = fakeDb({ invoices: [], invoice_form_submissions: [], invoice_lines: [], reimbursements: [], tc_approval_events: [], invoice_sends: [] }, { rpc: { next_document_number: () => 'INV-0100' } })
})

describe('one invoice a month across the form and the portal', () => {
  it('a live invoice sent from the portal for a pay period in the month takes it', async () => {
    fake.tables.invoices.push(portal({ id: 9, state: 'waiting', period_start: '2026-10-11', period_end: '2026-10-24' }))
    expect(await monthFor('jo@example.com', ME, '2026-10')).toEqual({ kind: 'taken' })
    expect(await monthFor('jo@example.com', ME, '2026-11')).toEqual({ kind: 'free' })
  })

  it('a pay period across two months takes both; one sent back (Draft) takes none', async () => {
    fake.tables.invoices.push(portal({ id: 9, state: 'paid', period_start: '2026-10-25', period_end: '2026-11-07' }))
    expect(await monthFor('jo@example.com', ME, '2026-10')).toEqual({ kind: 'taken' })
    expect(await monthFor('jo@example.com', ME, '2026-11')).toEqual({ kind: 'taken' })
    fake.tables.invoices[0].state = 'draft'
    expect(await monthFor('jo@example.com', ME, '2026-10')).toEqual({ kind: 'free' })
  })

  it('a form invoice sent back is still theirs to send again', async () => {
    fake.tables.invoices.push({ id: 40, person_id: ME, source: 'form_fixed', number: 'INV-0040', state: 'draft', period_start: '2026-10-01', period_end: '2026-10-31' })
    expect(await monthFor('jo@example.com', ME, '2026-10')).toEqual({ kind: 'again', invoiceId: 40, number: 'INV-0040' })
  })

  it('linking a new sender to a person who sent the month from the portal is refused', async () => {
    fake.tables.invoices.push(portal({ id: 9, state: 'approved', period_start: '2026-10-11', period_end: '2026-10-24' }))
    fake.tables.invoice_form_submissions.push({ id: 3, state: 'waiting', email: 'jo@example.com', sender: { name: 'Jo' }, source: 'form_fixed', period_start: '2026-10-01', period_end: '2026-10-31', lines: {}, reimbursements: [], total: 1800, own_pdf_path: null, own_pdf_name: null, created_at: '2026-11-02T10:00:00Z' })
    expect(await linkSubmission(3, ME, 'ao')).toEqual({ ok: false, error: 'That person already sent an invoice from the portal for October 2026.' })
    expect(fake.tables.invoices).toHaveLength(1)
  })
})

describe('a returned form invoice sent again', () => {
  const sub = { month: '2026-10', kind: 'fixed' as const, sender: { name: 'Jo Lee', line1: '1 Main St', line2: '', city: 'Austin', state: 'TX', zip: '78701', country: 'US' }, work: { kind: 'fixed' as const, covers: 'Design retainer', amount: 1800 }, reimbursements: [], own: null }
  const again = () => writeFormInvoice({ personId: ME, email: 'jo@example.com', sub, rates: { page: 30, asset: 10 }, receipts: new Map(), ownPdf: null, againId: 40, record: null })
  beforeEach(() => {
    fake.tables.invoices.push({ id: 40, person_id: ME, source: 'form_fixed', number: 'INV-0040', state: 'draft', total: 1700, paid_note: 'Wrong amount', period_start: '2026-10-01', period_end: '2026-10-31' })
    fake.tables.invoice_lines.push(
      { id: 400, invoice_id: 40, kind: 'fixed', client: null, description: 'Design retainer', hours_seconds: null, rate: null, amount: 1700, reimbursement_id: null, sort: 0, deliverable_kind: null, deliverable_key: null },
      { id: 401, invoice_id: 40, kind: 'reimbursement', client: 'Meals', description: 'Lunch', hours_seconds: null, rate: null, amount: 20, reimbursement_id: 500, sort: 1000, deliverable_kind: null, deliverable_key: null },
    )
    fake.tables.reimbursements.push({ id: 500, person_id: ME, invoice_id: 40, state: 'on_invoice', receipt_path: 'jo/r.pdf' })
  })
  const linesOf40 = () => fake.tables.invoice_lines.filter(l => l.invoice_id === 40)

  it('replaces the old lines and reimbursements when all is saved', async () => {
    expect(await again()).toEqual({ id: 40, number: 'INV-0040' })
    expect(linesOf40().map(l => [l.kind, l.amount])).toEqual([['fixed', 1800]])
    expect(fake.tables.reimbursements).toEqual([])
    expect(fake.tables.invoices[0]).toMatchObject({ state: 'waiting', total: 1800 })
  })

  it('the old lines cannot go: it fails and is put back as it was', async () => {
    failNextDelete('invoice_lines')
    await expect(again()).rejects.toThrow('The invoice was not saved: boom')
    expect(linesOf40().map(l => l.id)).toEqual([400, 401])
    expect(fake.tables.invoices[0]).toMatchObject({ state: 'draft', total: 1700, paid_note: 'Wrong amount' })
  })

  it('the old reimbursements cannot go: it fails, and the old lines come back with them', async () => {
    failNextDelete('reimbursements')
    await expect(again()).rejects.toThrow('The invoice was not saved: boom')
    expect(linesOf40().map(l => l.id).sort()).toEqual([400, 401])
    expect(fake.tables.reimbursements.map(r => r.id)).toEqual([500])
    expect(fake.tables.invoices[0]).toMatchObject({ state: 'draft', total: 1700, paid_note: 'Wrong amount' })
    expect(fake.removed).toEqual([])
  })
})
