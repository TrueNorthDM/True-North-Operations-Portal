import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeDb, type Fake } from '@/lib/directory/__fakes__/db'

// The approval gates tell "no check applies" from "the check could not be
// read" (audit, 5 November 2026): a read error is never a pass.

let fake: Fake
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fake.db }))
vi.mock('./pay-terms', () => ({ loadPayTerms: async () => new Map() }))
vi.mock('./invoices-data', () => ({ hoursByClient: async () => [] }))

const { readInvoiceCheck, loadInvoiceCheck } = await import('./invoice-check-data')

beforeEach(() => {
  fake = fakeDb({ invoices: [] })
})

describe('reading the check for a gate', () => {
  it('no such invoice: nothing to check', async () => {
    expect(await readInvoiceCheck(9)).toEqual({ ok: true, check: null })
    expect(await loadInvoiceCheck(9)).toBeNull()
  })

  it('the invoice cannot be read: an error, not "nothing to check"', async () => {
    fake = fakeDb({ invoices: [] }, { fail: ['invoices'] })
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await readInvoiceCheck(9)).toEqual({ ok: false, error: 'The invoice could not be read: boom' })
    // The screens still read null and show no check.
    expect(await loadInvoiceCheck(9)).toBeNull()
    err.mockRestore()
  })
})
