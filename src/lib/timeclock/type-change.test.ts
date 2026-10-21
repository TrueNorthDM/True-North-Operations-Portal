import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
const { typeChangeOptions } = await import('./type-change')

describe('contractor to employee (Company Settings.dc.html 10A-3)', () => {
  // Nov 3, 2026; pay periods start on Oct 4, Oct 18, Nov 1, Nov 15, Nov 29...
  const o = typeChangeOptions('2026-11-03', '2026-10-04', 'Dave Sharpe')

  it('offers the next 1st, the next pay period start and the 1st after', () => {
    expect(o.map(x => x.label)).toEqual(['Tue, Dec 1, 2026 (first day of a month)', 'Sun, Nov 29, 2026 (first day of a pay period)', 'Fri, Jan 1, 2027 (first day of a month)'])
  })

  it('says what happens from a 1st: the month closes, a short first pay period', () => {
    expect(o[0].steps.map(s => s.title)).toEqual(['Until Mon, Nov 30: contractor', 'Dec 1 to 12: first pay period, short', 'From Sun, Dec 13: every 2 weeks'])
    expect(o[0].steps[0].text).toBe('November closes monthly. Submitting it makes their last invoice, approved by Dave Sharpe; reimbursements approved until then go on it.')
    expect(o[0].steps[1].text).toBe('The pay period Nov 29 to Dec 12 has already started, so their first one is Dec 1 to 12. Approved hours go to Rippling.')
  })

  it('and from a pay period start: the month closes early', () => {
    expect(o[1].steps.map(s => s.title)).toEqual(['Until Sat, Nov 28: contractor', 'From Sun, Nov 29: every 2 weeks', 'From then on'])
    expect(o[1].steps[0].text).toBe('November closes early, Nov 1 to 28, as their last invoice, approved by Dave Sharpe.')
    expect(o[1].steps[1].text).toBe('Their first pay period is Nov 29 to Dec 12. Approved hours go to Rippling.')
    expect(o[2].steps.map(s => s.title)).toEqual(['Until Thu, Dec 31: contractor', 'Jan 1 to 9: first pay period, short', 'From Sun, Jan 10: every 2 weeks'])
  })
})
