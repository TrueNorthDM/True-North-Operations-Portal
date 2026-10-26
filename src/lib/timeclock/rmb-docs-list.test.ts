import { describe, expect, it } from 'vitest'
import { buildRmbDocList, csvTotal, type RmbDocListSource } from './rmb-docs-list'

const PEOPLE: Record<string, { name: string; team: string; color: string }> = {
  wc: { name: 'Wendy Cacka', team: 'Web', color: '#A99BD4' },
  ds: { name: 'Dave Sharpe', team: 'Leadership', color: '#012358' },
}

const src = (over: Partial<RmbDocListSource> = {}): RmbDocListSource => ({
  finance: true,
  docs: [
    { id: 29, number: 'RMB-2026-0029', person_id: 'ds', state: 'paid', total: 41.4, paid_on: '2026-10-08', paid_ref: 'ACH-20261008', created_at: '2026-09-28T15:00:00Z' },
    { id: 31, number: 'RMB-2026-0031', person_id: 'wc', state: 'approved', total: 57.99, paid_on: null, paid_ref: null, created_at: '2026-10-21T20:05:00Z' },
    { id: 30, number: 'RMB-2026-0030', person_id: 'ds', state: 'approved', total: 45, paid_on: null, paid_ref: null, created_at: '2026-10-02T03:30:00Z' },
  ],
  items: [
    { document_id: 31, amount: 12.99, currency: 'USD', decided_at: '2026-10-21T20:05:00Z' },
    { document_id: 31, amount: 45, currency: 'USD', decided_at: '2026-11-03T14:32:00Z' },
    { document_id: 30, amount: 45, currency: 'USD', decided_at: '2026-10-02T03:30:00Z' },
    { document_id: 30, amount: 4500, currency: 'KES', decided_at: '2026-10-02T03:30:00Z' },
    { document_id: 29, amount: 41.4, currency: null, decided_at: '2026-09-28T15:00:00Z' },
  ],
  person: id => PEOPLE[id],
  financeNames: 'Tina Gennette',
  zone: 'America/New_York',
  today: '2026-10-25',
  ...over,
})

describe('the reimbursement documents list', () => {
  it('lists the newest number first, with the Invoices list columns', () => {
    const l = buildRmbDocList(src())
    expect(l.rows.map(r => r.number)).toEqual(['RMB-2026-0031', 'RMB-2026-0030', 'RMB-2026-0029'])
    expect(l.rows[0]).toMatchObject({ who: 'Wendy Cacka', initials: 'WC', team: 'Web', items: 2, date: 'Oct 21, 2026', period: 'October 2026', total: '$57.99', st: 'appr', where: 'Waiting for Finance', canPay: true, payLine: '2 items · approved Nov 3, 2026' })
    expect(l.rows[2]).toMatchObject({ st: 'paid', where: 'Oct 8, 2026 · ACH-20261008', paidOn: '2026-10-08', canPay: false })
  })

  it('dates a document in the viewer\'s zone, for the date and the period', () => {
    // 03:30 UTC on Oct 2 is still Oct 1 in New York.
    const r = buildRmbDocList(src()).rows[1]
    expect(r.date).toBe('Oct 1, 2026')
    expect(buildRmbDocList(src()).periods).toEqual(['October 2026', 'September 2026'])
  })

  it('totals each currency on its own, as the document pages do', () => {
    const l = buildRmbDocList(src())
    expect(l.rows[1].total).toBe('$45.00 + KES 4,500.00')
    expect(l.toPay).toEqual({ count: 2, total: '$102.99 + KES 4,500.00' })
    expect(l.paidIn).toEqual({ label: 'October', count: 1, total: '$41.40' })
  })

  it('offers Mark paid to Finance alone', () => {
    expect(buildRmbDocList(src({ finance: false })).rows.some(r => r.canPay)).toBe(false)
  })

  it('falls back on the document\'s own total when no item was read', () => {
    const l = buildRmbDocList(src({ items: [] }))
    expect(l.rows[0]).toMatchObject({ total: '$57.99', items: 0, payLine: '0 items' })
  })

  it('writes the CSV total as a number for one currency, as the text for several', () => {
    expect(csvTotal([{ amount: 12.99, currency: 'USD' }, { amount: 45, currency: 'USD' }])).toEqual({ total: '57.99', currency: 'USD' })
    expect(csvTotal([{ amount: 4500, currency: 'KES' }, { amount: 45, currency: 'USD' }])).toEqual({ total: '$45.00 + KES 4,500.00', currency: 'USD + KES' })
    expect(csvTotal([])).toEqual({ total: '0.00', currency: 'USD' })
  })
})
