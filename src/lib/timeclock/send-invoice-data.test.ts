import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeDb, type Fake } from '@/lib/directory/__fakes__/db'

// What a contractor still has to send (audit, 5 November 2026): an invoice sent
// back to them offers again the reimbursements still on it, and a month the
// invoice form already has is not offered here.

let fake: Fake
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fake.db }))
vi.mock('./pay-terms', () => ({
  loadPayTerms: async (ids: string[]) => new Map(ids.map(id => [id, { route: { isContractor: true }, paysAs: 'fixed_no_timesheet', hourlyRate: null, fixedAmount: 1800 }])),
}))
vi.mock('./invoices-data', () => ({ hoursByClient: async () => [] }))

const { loadInvoicesToSend, reimbursementsFor } = await import('./send-invoice-data')

const ME = 'jo'
const NOW = new Date('2026-11-05T15:00:00Z')
const inv = (over: Record<string, unknown>) => ({ person_id: ME, kind: 'fixed_no_timesheet', submission_id: null, source: null, paid_note: null, ...over })
const rmb = (id: number, over: Record<string, unknown> = {}) => ({ id, person_id: ME, receipt_number: `RCT-${id}`, purpose: 'Lunch', amount: 20, state: 'approved', invoice_id: null, asked_at: '2026-10-01', ...over })

beforeEach(() => {
  fake = fakeDb({ invoices: [], reimbursements: [rmb(1)] })
})

describe('the months to send for, with no timesheet', () => {
  it('a portal invoice sent back offers the reimbursements still on it, for that send only', async () => {
    fake.tables.invoices.push(inv({ id: 9, number: 'INV-0009', state: 'draft', period_start: '2026-10-01', paid_note: 'Add the receipt' }))
    fake.tables.reimbursements.push(rmb(2, { state: 'on_invoice', invoice_id: 9 }), rmb(3, { state: 'on_invoice', invoice_id: 44 }))
    const d = (await loadInvoicesToSend(ME, NOW))!
    expect(d.reimbursements.map(r => r.id)).toEqual([1])
    const oct = d.toSend.find(p => p.start === '2026-10-01')!
    expect(oct.returned).toEqual({ number: 'INV-0009', reason: 'Add the receipt', reimbursements: [{ id: 2, label: 'RCT-2', purpose: 'Lunch', amount: 20 }] })
    expect(reimbursementsFor(d, oct).map(r => r.id)).toEqual([1, 2])
    const nov = d.toSend.find(p => p.start === '2026-11-01')!
    expect(nov.returned).toBeNull()
    expect(reimbursementsFor(d, nov).map(r => r.id)).toEqual([1])
  })

  it('a month the invoice form already has (waiting) is not offered; one it sent back is offered as new here', async () => {
    fake.tables.invoices.push(
      inv({ id: 40, number: 'INV-0040', state: 'waiting', period_start: '2026-10-01', source: 'form_fixed' }),
      inv({ id: 41, number: 'INV-0041', state: 'draft', period_start: '2026-11-01', source: 'form_fixed' }),
    )
    const d = (await loadInvoicesToSend(ME, NOW))!
    expect(d.toSend.map(p => [p.start, p.returned])).toEqual([['2026-11-01', null]])
  })
})
