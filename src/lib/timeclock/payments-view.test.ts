import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

const { buildContractorPayments } = await import('./payments-view')

// Contractors make and send their own invoice (leadership, 4 November 2026): the tab says so.
describe("a contractor's Payments tab", () => {
  it('says the invoices are the ones they send', () => {
    const d = buildContractorPayments({
      name: 'Jo Lee', invoices: [], reimbursements: [], route: undefined,
      settings: { invoiceApprovers: [], defaultApprover: 'ao', deputyDirector: null } as never, nameOf: () => '', today: '2026-11-05',
    })
    const [invoices, rmb] = d.tables
    expect(invoices.sub).toBe('One a month, the one you send.')
    expect(invoices.empty).toBe('No invoices yet. The first one appears when you send your invoice.')
    expect(rmb.sub).toBe('Approved ones wait for you to add them to your next invoice.')
    expect(JSON.stringify(d)).not.toMatch(/timesheet is submitted|by themselves/)
  })
})
