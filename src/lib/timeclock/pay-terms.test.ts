import { describe, expect, it, vi } from 'vitest'

// The rows loadPayTerms reads, per table.
const tables: Record<string, Record<string, unknown>[]> = { people: [], pay_terms: [] }
const selected: Record<string, string> = {}
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const q = {
        select: (cols: string) => { selected[table] = cols; return q },
        in: () => q,
        eq: () => q,
        order: () => q,
        range: () => q,
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        then: (ok: (r: { data: unknown; error: null }) => unknown) => Promise.resolve({ data: tables[table] ?? [], error: null }).then(ok),
      }
      return q
    },
  }),
}))

import { isFinance, loadPayTerms, paysWhat } from './pay-terms'

// Who is shown To pay on Home and on the rail (owner, 25 October 2026).
describe('what Finance pays', () => {
  const settings = { finance: ['tina'] }
  const access = (personId: string | null, keys: string[]) => ({ personId, can: (k: string) => keys.includes(k) })

  it('is shown to Super Admins (ck-money) and Finance, never to an Admin who is not Finance (5 November 2026)', () => {
    expect(isFinance({ personId: 'tina' }, settings)).toBe(true)
    expect(isFinance({ personId: 'dave' }, settings)).toBe(false)
    expect(isFinance({ personId: null }, settings)).toBe(false)
    expect(paysWhat(access('dave', ['clocky-invoices', 'rq-reimbursements']), settings)).toEqual({ invoices: false, documents: false })
    expect(paysWhat(access('dave', ['clocky-invoices', 'rq-reimbursements', 'ck-money']), settings)).toEqual({ invoices: false, documents: false })
    expect(paysWhat(access('dave', ['clocky-invoices', 'rq-reimbursements', 'ck-money', 'ck-inv-all', 'rq-rmb-all']), settings)).toEqual({ invoices: true, documents: true })
  })

  it('pays each kind where the page that marks it paid is open', () => {
    expect(paysWhat(access('tina', ['clocky-invoices', 'rq-reimbursements']), settings)).toEqual({ invoices: true, documents: true })
    expect(paysWhat(access('tina', ['rq-reimbursements']), settings)).toEqual({ invoices: false, documents: true })
    expect(paysWhat(access('tina', ['clocky-invoices']), settings)).toEqual({ invoices: true, documents: false })
  })
})

// One field (owner, 5 November 2026): the allowance is a contractor's Weekly hours, a week.
describe('loadPayTerms: the allowance from Weekly hours', () => {
  const person = (id: string, employment_type: string, weekly_hours: number | null) =>
    ({ id, manager_id: null, employment_type, internal_rate: 20, monthly_salary: null, weekly_hours, hours_limit_per: 'week' })

  it('a contractor with Weekly hours: that many hours a week; without: none; an employee: none', async () => {
    tables.people = [person('con', 'contractor', 30), person('free', 'contractor', null), person('emp', 'us', 40)]
    // An old allowance stored in pay_terms is no longer read.
    tables.pay_terms = [{ person_id: 'con', pays_as: 'hourly', allowance_hours: 120, allowance_period: 'month' }]
    const terms = await loadPayTerms(['con', 'free', 'emp'])
    expect(terms.get('con')?.allowance).toEqual({ hours: 30, per: 'week', cadence: [], anchors: [] })
    expect(terms.get('free')?.allowance).toBeNull()
    expect(terms.get('emp')?.allowance).toBeNull()
    expect(terms.get('emp')?.salaried).toBe(true)
    expect(selected.pay_terms).not.toMatch(/allowance/)
    expect(selected.people).toMatch(/weekly_hours/)
    expect(selected.people).toMatch(/hours_limit_per/)
  })
})
