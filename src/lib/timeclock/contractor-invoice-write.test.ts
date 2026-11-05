import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeDb, type Fake } from '@/lib/directory/__fakes__/db'

// Sending a contractor's own invoice from the portal (audit, 5 November 2026):
// one invoice a month across both ways, a reimbursement never on two
// invoices, a sent-back invoice sent again only once.

let fake: Fake
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fake.db }))
vi.mock('./pay-terms', () => ({ loadInvoiceSettings: async () => ({ paymentDays: 15, billingName: 'True North', billingAddress: '', billingEmail: 'finance@example.com' }) }))

const { writeSentInvoice, ALREADY_SENT, RMB_TAKEN } = await import('./contractor-invoice')
type Rec = Parameters<typeof writeSentInvoice>[0]['record']

const ME = 'jo'
const NOW = new Date('2026-11-05T15:00:00Z')
const record = (over: Partial<Rec> = {}): Rec => ({
  madeBy: 'builder', sentFrom: 'portal', sentBy: ME, sentEmail: null, confirmed: 'This is my invoice.', theirNumber: null,
  statedHours: null, statedTotal: null, covers: null, ownPdf: null,
  // 35h 20m from the timesheet, at whatever rate: the one on file ($50) is put back.
  lines: [{ description: 'i7 Marketing, Oct 11 to 24, 2026', client: 'i7 Marketing', hours: 35.33, rate: 99, amount: null }],
  total: 0, ...over,
})
const send = (over: Partial<Parameters<typeof writeSentInvoice>[0]> = {}) => writeSentInvoice({
  personId: ME, submissionId: 7, start: '2026-10-11', end: '2026-10-24', kind: 'hourly', record: record(), reimbursementIds: [], now: NOW, ...over,
})

/** Runs `fn` just before the next write of this kind on a table: another request getting there first. */
function before(table: string, op: 'update' | 'delete', fn: () => void) {
  const db = fake.db as unknown as { from: (t: string) => Record<string, (...a: unknown[]) => unknown> }
  const from = db.from
  let done = false
  db.from = (t: string) => {
    const q = from(t)
    if (t === table && !done) {
      const orig = q[op]
      q[op] = (...a: unknown[]) => { done = true; fn(); return orig(...a) }
    }
    return q
  }
}

const rmb = (id: number, over: Record<string, unknown> = {}) => ({ id, person_id: ME, category: 'Meals', purpose: 'Client lunch', amount: 84.2, state: 'approved', invoice_id: null, ...over })
const linesOf = (invoiceId: unknown) => fake.tables.invoice_lines.filter(l => l.invoice_id === invoiceId)

beforeEach(() => {
  fake = fakeDb({
    people: [{ id: ME, full_name: 'Jo Lee', location: 'Austin', email_personal: 'jo@example.com', email_true_north: null, internal_rate: 50, monthly_salary: null }],
    invoices: [], invoice_lines: [], invoice_sends: [],
    reimbursements: [rmb(5), rmb(6, { amount: 20 })],
  }, { rpc: { next_document_number: () => 'INV-0100' } })
})

describe('a new invoice', () => {
  it('bills 35h 20m at the rate on file to the cent, with the reimbursement on it', async () => {
    const r = await send({ reimbursementIds: [5] })
    expect(r).toMatchObject({ number: 'INV-0100', total: 1850.7 })
    const inv = fake.tables.invoices[0]
    expect(inv).toMatchObject({ state: 'waiting', total: 1850.7, made_by: 'builder' })
    expect(linesOf(r.id).map(l => [l.kind, l.hours_seconds, l.rate, l.amount])).toEqual([['hours', 127188, 50, 1766.5], ['reimbursement', null, null, 84.2]])
    expect(fake.tables.reimbursements.find(x => x.id === 5)).toMatchObject({ state: 'on_invoice', invoice_id: r.id })
  })

  it('a reimbursement taken by another invoice while sending: refused, and nothing of this send stays', async () => {
    before('reimbursements', 'update', () => Object.assign(fake.tables.reimbursements.find(x => x.id === 5)!, { state: 'on_invoice', invoice_id: 77 }))
    await expect(send({ reimbursementIds: [5, 6] })).rejects.toThrow(RMB_TAKEN)
    const inv = fake.tables.invoices[0]
    // Back to them to send again, keeping its number; no lines; each reimbursement where it was.
    expect(inv.state).toBe('draft')
    expect(linesOf(inv.id)).toEqual([])
    expect(fake.tables.reimbursements.find(x => x.id === 5)).toMatchObject({ state: 'on_invoice', invoice_id: 77 })
    expect(fake.tables.reimbursements.find(x => x.id === 6)).toMatchObject({ state: 'approved', invoice_id: null })
    expect(fake.tables.invoice_sends).toEqual([])
  })

  it('a reimbursement already on another invoice is refused before anything is written', async () => {
    fake.tables.reimbursements[0] = rmb(5, { state: 'on_invoice', invoice_id: 77 })
    await expect(send({ reimbursementIds: [5] })).rejects.toThrow(/already on another invoice/)
    expect(fake.tables.invoices).toEqual([])
  })
})

describe('one invoice a month across both ways', () => {
  it('refused when the invoice form already has a live invoice for the month', async () => {
    fake.tables.invoices.push({ id: 40, person_id: ME, number: 'INV-0040', source: 'form_fixed', state: 'waiting', period_start: '2026-10-01', period_end: '2026-10-31', kind: 'fixed_no_timesheet', submission_id: null })
    await expect(send()).rejects.toThrow('You already sent an invoice for October 2026 with the invoice form (INV-0040). One invoice a month: to change it, write to Finance at finance@example.com.')
    expect(fake.tables.invoices).toHaveLength(1)
  })

  it('a form invoice sent back to them (Draft) does not take the month, nor one for another month', async () => {
    fake.tables.invoices.push(
      { id: 40, person_id: ME, number: 'INV-0040', source: 'form_fixed', state: 'draft', period_start: '2026-10-01', period_end: '2026-10-31', kind: 'fixed_no_timesheet', submission_id: null },
      { id: 41, person_id: ME, number: 'INV-0041', source: 'form_fixed', state: 'paid', period_start: '2026-09-01', period_end: '2026-09-30', kind: 'fixed_no_timesheet', submission_id: null },
    )
    await expect(send()).resolves.toMatchObject({ number: 'INV-0100' })
  })
})

describe('sent again after it was sent back', () => {
  const back = () => {
    fake.tables.invoices.push({
      id: 9, person_id: ME, number: 'INV-0009', source: null, state: 'draft', submission_id: 7, kind: 'hourly', period_start: '2026-10-11', period_end: '2026-10-24',
      total: 1850.7, paid_note: 'Fix the hours', made_by: 'builder', issued_on: '2026-10-25', due_on: '2026-11-09',
    })
    fake.tables.invoice_lines.push(
      { id: 90, invoice_id: 9, kind: 'hours', client: 'i7 Marketing', hours_seconds: 126000, rate: 50, amount: 1750, reimbursement_id: null, sort: 0 },
      { id: 91, invoice_id: 9, kind: 'reimbursement', client: null, hours_seconds: null, rate: null, amount: 84.2, reimbursement_id: 5, sort: 1000 },
    )
    Object.assign(fake.tables.reimbursements[0], { state: 'on_invoice', invoice_id: 9 })
  }

  it('keeps its number, replaces its lines, and may keep the reimbursement already on it', async () => {
    back()
    const r = await send({ reimbursementIds: [5] })
    expect(r).toMatchObject({ id: 9, number: 'INV-0009', total: 1850.7 })
    expect(fake.tables.invoices.find(i => i.id === 9)).toMatchObject({ state: 'waiting', paid_note: null })
    expect(linesOf(9).map(l => [l.kind, l.amount])).toEqual([['hours', 1766.5], ['reimbursement', 84.2]])
    expect(fake.tables.reimbursements.find(x => x.id === 5)).toMatchObject({ state: 'on_invoice', invoice_id: 9 })
  })

  it('a reimbursement on it they leave out goes back to waiting for an invoice', async () => {
    back()
    await send({ reimbursementIds: [] })
    expect(linesOf(9).map(l => l.kind)).toEqual(['hours'])
    expect(fake.tables.reimbursements.find(x => x.id === 5)).toMatchObject({ state: 'approved', invoice_id: null })
  })

  it('two sends at once: one goes through, the other is refused, and the lines are never doubled', async () => {
    back()
    const both = await Promise.allSettled([send({ reimbursementIds: [5] }), send({ reimbursementIds: [5] })])
    expect(both.filter(x => x.status === 'fulfilled')).toHaveLength(1)
    expect(both.find(x => x.status === 'rejected')).toMatchObject({ reason: new Error(ALREADY_SENT) })
    expect(linesOf(9).map(l => l.kind)).toEqual(['hours', 'reimbursement'])
  })

  it('claimed by another send first: refused before its lines are touched', async () => {
    back()
    before('invoices', 'update', () => { fake.tables.invoices.find(i => i.id === 9)!.state = 'waiting' })
    await expect(send()).rejects.toThrow(ALREADY_SENT)
    expect(linesOf(9).map(l => l.id)).toEqual([90, 91])
  })

  it('when the old lines cannot go, it is put back as it was, with its reason', async () => {
    back()
    // The first delete of invoice_lines (the old lines) fails, as a lost connection would.
    const db = fake.db as unknown as { from: (t: string) => Record<string, (...a: unknown[]) => unknown> }
    const from = db.from
    let failed = false
    db.from = (t: string) => {
      const q = from(t)
      if (t === 'invoice_lines' && !failed) {
        const del = q.delete
        q.delete = () => {
          failed = true
          del()
          q.then = ((ok: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'boom' } }).then(ok)) as never
          return q
        }
      }
      return q
    }
    await expect(send({ reimbursementIds: [5] })).rejects.toThrow(/not saved/)
    expect(fake.tables.invoices.find(i => i.id === 9)).toMatchObject({ state: 'draft', paid_note: 'Fix the hours', total: 1850.7, issued_on: '2026-10-25' })
    expect(linesOf(9).map(l => l.id)).toEqual([90, 91])
    expect(fake.tables.reimbursements.find(x => x.id === 5)).toMatchObject({ state: 'on_invoice', invoice_id: 9 })
  })
})
