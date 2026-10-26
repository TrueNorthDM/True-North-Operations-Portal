import { describe, expect, it } from 'vitest'
import { isFinance, paysWhat } from './pay-terms'

// Who is shown To pay on Home and on the rail (owner, 25 October 2026).
describe('what Finance pays', () => {
  const settings = { finance: ['tina'] }
  const access = (personId: string | null, keys: string[], isAdmin = false) => ({ personId, isAdmin, can: (k: string) => keys.includes(k) })

  it('is shown to Super Admins, Admins and Finance', () => {
    expect(isFinance({ personId: 'tina' }, settings)).toBe(true)
    expect(isFinance({ personId: 'dave' }, settings)).toBe(false)
    expect(isFinance({ personId: null }, settings)).toBe(false)
    expect(paysWhat(access('dave', ['clocky-invoices', 'rq-reimbursements']), settings)).toEqual({ invoices: false, documents: false })
    expect(paysWhat(access('dave', ['clocky-invoices', 'rq-reimbursements'], true), settings)).toEqual({ invoices: true, documents: true })
  })

  it('pays each kind where the page that marks it paid is open', () => {
    expect(paysWhat(access('tina', ['clocky-invoices', 'rq-reimbursements']), settings)).toEqual({ invoices: true, documents: true })
    expect(paysWhat(access('tina', ['rq-reimbursements']), settings)).toEqual({ invoices: false, documents: true })
    expect(paysWhat(access('tina', ['clocky-invoices']), settings)).toEqual({ invoices: true, documents: false })
  })
})
