import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('./clocky-notify', () => ({ announceInvoiceMade: vi.fn(), announceTimesheetSubmitted: vi.fn() }))
vi.mock('./invoices-data', () => ({ writeInvoice: vi.fn() }))
vi.mock('./pay-terms', () => ({ loadInvoiceSettings: vi.fn(), loadPayTerms: vi.fn() }))

const { previousMonth } = await import('./invoices-cron')

describe('day 1 (fixed, no timesheet invoices)', () => {
  it('invoices the month that just ended, by the New York calendar', () => {
    expect(previousMonth(new Date('2026-11-01T11:00:00Z'))).toEqual({ start: '2026-10-01', end: '2026-10-31' })
    // 01:00 UTC on Nov 1 is still Oct 31 in New York: the month before that.
    expect(previousMonth(new Date('2026-11-01T01:00:00Z'))).toEqual({ start: '2026-09-01', end: '2026-09-30' })
    expect(previousMonth(new Date('2027-01-01T12:00:00Z'))).toEqual({ start: '2026-12-01', end: '2026-12-31' })
  })
})
