import { describe, it, expect } from 'vitest'
import { periodFor, shiftMonth, monthName, whatCanIDo } from './periods'
import {
  anchorMove, cadenceChange, cadenceLine, cadenceOn, companyPayPeriods, gridPeriod, isLocked, lockedBy, lockedMessage,
  payPeriodStart, periodContaining, periodLabel, periodsBetween, periodToSubmit, type AnchorChange, type CadenceRules,
} from './periods'

describe('periodFor', () => {
  it('gives the month a date falls in, with both ends', () => {
    expect(periodFor('2026-08-05')).toEqual({ month: '2026-08', start: '2026-08-01', end: '2026-08-31' })
  })

  it('knows the short months', () => {
    expect(periodFor('2026-04-30').end).toBe('2026-04-30')
    expect(periodFor('2026-02-10').end).toBe('2026-02-28')
  })

  it('knows a leap February', () => {
    expect(periodFor('2024-02-01').end).toBe('2024-02-29')
  })

  it('handles the last day of December without rolling the year', () => {
    expect(periodFor('2025-12-31')).toEqual({ month: '2025-12', start: '2025-12-01', end: '2025-12-31' })
  })
})

describe('shiftMonth', () => {
  it('steps back and forward', () => {
    expect(shiftMonth('2026-08', -1)).toBe('2026-07')
    expect(shiftMonth('2026-08', 1)).toBe('2026-09')
  })

  it('crosses the year in both directions', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2025-12', 1)).toBe('2026-01')
  })

  it('does not drift when stepping from a long month to a short one', () => {
    // The classic date bug: adding a month to the 31st lands in the month after
    // next. Building from the first of the month is what avoids it.
    expect(shiftMonth('2026-01', 1)).toBe('2026-02')
    expect(shiftMonth('2026-03', -1)).toBe('2026-02')
  })

  it('walks a whole year without losing a month', () => {
    let m = '2026-01'
    const seen = [m]
    for (let i = 0; i < 11; i++) { m = shiftMonth(m, 1); seen.push(m) }
    expect(seen).toHaveLength(12)
    expect(new Set(seen).size).toBe(12)
    expect(seen[11]).toBe('2026-12')
  })
})

describe('monthName', () => {
  it('reads as a person would say it', () => {
    expect(monthName('2026-08')).toBe('August 2026')
    expect(monthName('2026-01')).toBe('January 2026')
  })
})

describe('whatCanIDo', () => {
  it('lets an untouched month be edited and sent', () => {
    const r = whatCanIDo(null)
    expect(r.canEdit).toBe(true)
    expect(r.canSubmit).toBe(true)
  })

  it('freezes a month that is waiting on somebody', () => {
    const r = whatCanIDo('submitted')
    expect(r.canEdit).toBe(false)
    expect(r.canSubmit).toBe(false)
  })

  it('freezes an approved month hardest of all', () => {
    const r = whatCanIDo('approved')
    expect(r.canEdit).toBe(false)
    expect(r.canSubmit).toBe(false)
  })

  it('reopens a month that was handed back, and lets it be sent again', () => {
    const r = whatCanIDo('returned')
    expect(r.canEdit).toBe(true)
    expect(r.canSubmit).toBe(true)
  })

  it('never lets a month be submitted while it cannot be edited', () => {
    // Not a coincidence worth relying on by accident: if a state is ever added
    // that allows sending what cannot be changed, this is where it shows up.
    for (const s of [null, 'draft', 'submitted', 'approved', 'returned'] as const) {
      const r = whatCanIDo(s)
      if (r.canSubmit) expect(r.canEdit).toBe(true)
    }
  })
})

// ── Clocky: monthly or every 2 weeks (SPEC 11A, Timesheet Periods.dc.html) ──


const OCT4: AnchorChange[] = [{ anchor: '2026-10-04', effectiveFrom: null }]
const monthly: CadenceRules = { changes: [], fallback: 'monthly', anchors: OCT4 }
const biweekly: CadenceRules = { changes: [], fallback: 'biweekly', anchors: OCT4 }

describe('pay periods: 14 days from the company start date', () => {
  it('counts forward and backward from the anchor', () => {
    expect(payPeriodStart('2026-10-15', '2026-10-04')).toBe('2026-10-04')
    expect(payPeriodStart('2026-10-17', '2026-10-04')).toBe('2026-10-04')
    expect(payPeriodStart('2026-10-18', '2026-10-04')).toBe('2026-10-18')
    expect(payPeriodStart('2026-10-03', '2026-10-04')).toBe('2026-09-20')
  })

  it('gives a person on pay periods the 14 days, and a monthly person the month', () => {
    expect(periodContaining('2026-10-15', biweekly)).toEqual({ start: '2026-10-04', end: '2026-10-17', kind: 'pay_period' })
    expect(periodContaining('2026-10-15', monthly)).toEqual({ start: '2026-10-01', end: '2026-10-31', kind: 'month' })
  })

  it('lists the company\'s periods around today: one closed, the current one, the next four', () => {
    expect(companyPayPeriods('2026-10-15', OCT4).map(p => `${p.start}/${p.end}/${p.state}`)).toEqual([
      '2026-09-20/2026-10-03/closed', '2026-10-04/2026-10-17/current', '2026-10-18/2026-10-31/next',
      '2026-11-01/2026-11-14/next', '2026-11-15/2026-11-28/next', '2026-11-29/2026-12-12/next',
    ])
  })

  it('names periods for the Submit button and the dialog (3H)', () => {
    expect(periodLabel({ start: '2026-10-01', end: '2026-10-31' })).toEqual({ label: 'October', full: 'October 2026' })
    expect(periodLabel({ start: '2026-10-04', end: '2026-10-17' })).toEqual({ label: 'Oct 4 to 17', full: 'Oct 4 to 17, 2026' })
    expect(cadenceLine({ start: '2026-10-01', end: '2026-10-31', kind: 'month' }))
      .toBe('You submit monthly. October runs to Sat, Oct 31. A Super Admin sets this per person.')
    expect(cadenceLine({ start: '2026-10-04', end: '2026-10-17', kind: 'pay_period' }))
      .toBe('You submit every 2 weeks, by pay period. This one runs Sun, Oct 4 to Sat, Oct 17. A Super Admin sets this per person.')
  })
})

describe('changing how a person submits never cuts a period in half (11A)', () => {
  it('monthly to every 2 weeks: the month still closes monthly; aligned, no short period', () => {
    const plan = cadenceChange('2026-10-15', 'biweekly', monthly)
    expect(plan.insert).toEqual([{ cadence: 'biweekly', effectiveFrom: '2026-11-01' }])
    expect(plan.text).toBe('Starts with the pay period of Nov 1 to 14. October still closes monthly.')
  })

  it('monthly to every 2 weeks: the days between the month and the first pay period close as one short period', () => {
    const rules: CadenceRules = { ...monthly, anchors: [{ anchor: '2026-10-08', effectiveFrom: null }] }
    const plan = cadenceChange('2026-10-15', 'biweekly', rules)
    expect(plan.effectiveFrom).toBe('2026-11-01')
    expect(plan.text).toBe('Starts with the pay period of Nov 5 to 18. October still closes monthly, and Nov 1 to 4 closes as one short period.')
    const after = { ...rules, changes: plan.insert }
    expect(periodContaining('2026-10-20', after)).toEqual({ start: '2026-10-01', end: '2026-10-31', kind: 'month' })
    expect(periodContaining('2026-11-02', after)).toEqual({ start: '2026-11-01', end: '2026-11-04', kind: 'pay_period' })
    expect(periodContaining('2026-11-10', after)).toEqual({ start: '2026-11-05', end: '2026-11-18', kind: 'pay_period' })
  })

  it('every 2 weeks to monthly: the current pay period closes as it is, the rest of the month as one last pay period', () => {
    const plan = cadenceChange('2026-10-15', 'monthly', biweekly)
    expect(plan.insert).toEqual([
      { cadence: 'biweekly', effectiveFrom: '2026-10-18', onePeriod: true },
      { cadence: 'monthly', effectiveFrom: '2026-11-01' },
    ])
    expect(plan.text).toBe('Starts in November. The current pay period (Oct 4 to 17) closes as it is, then Oct 18 to 31 closes as one last pay period.')
    const after = { ...biweekly, changes: plan.insert }
    expect(periodContaining('2026-10-10', after)).toEqual({ start: '2026-10-04', end: '2026-10-17', kind: 'pay_period' })
    expect(periodContaining('2026-10-25', after)).toEqual({ start: '2026-10-18', end: '2026-10-31', kind: 'pay_period' })
    expect(periodContaining('2026-11-03', after)).toEqual({ start: '2026-11-01', end: '2026-11-30', kind: 'month' })
  })

  it('every 2 weeks to monthly with no days left: monthly starts on the 1st', () => {
    const plan = cadenceChange('2026-10-25', 'monthly', biweekly)
    expect(plan.insert).toEqual([{ cadence: 'monthly', effectiveFrom: '2026-11-01' }])
    expect(plan.text).toBe('Starts in November. The current pay period (Oct 18 to 31) closes as it is.')
  })

  it('every 2 weeks to monthly when the pay period crosses the month: monthly starts the month after', () => {
    const plan = cadenceChange('2026-11-03', 'monthly', biweekly)
    expect(plan.effectiveFrom).toBe('2026-12-01')
    expect(plan.text).toBe('Starts in December. The current pay period (Nov 1 to 14) closes as it is, then Nov 15 to 30 closes as one last pay period.')
  })

  it('changing back before it takes effect undoes it', () => {
    const scheduled: CadenceRules = { ...monthly, changes: [{ cadence: 'biweekly', effectiveFrom: '2026-11-01' }] }
    expect(cadenceChange('2026-10-20', 'monthly', scheduled)).toEqual({ insert: [], effectiveFrom: null, text: '' })
    expect(cadenceOn('2026-10-20', scheduled).cadence).toBe('monthly')
    expect(cadenceOn('2026-11-02', scheduled).cadence).toBe('biweekly')
  })

  it('back to every 2 weeks during the last pay period: it still closes as planned', () => {
    const inStretch: CadenceRules = {
      ...biweekly,
      changes: [{ cadence: 'biweekly', effectiveFrom: '2026-10-18', onePeriod: true }, { cadence: 'monthly', effectiveFrom: '2026-11-01' }],
    }
    const plan = cadenceChange('2026-10-20', 'biweekly', inStretch)
    expect(plan.insert).toEqual([{ cadence: 'biweekly', effectiveFrom: '2026-11-01' }])
    expect(plan.text).toBe('Starts with the pay period of Nov 1 to 14. The current pay period (Oct 18 to 31) closes as it is.')
  })

  it('leaves no gap and no overlap between periods across the changes', () => {
    const rules: CadenceRules = {
      fallback: 'monthly',
      anchors: [{ anchor: '2026-10-08', effectiveFrom: null }],
      changes: [
        { cadence: 'biweekly', effectiveFrom: '2026-11-01' },
        { cadence: 'biweekly', effectiveFrom: '2026-12-03', onePeriod: true },
        { cadence: 'monthly', effectiveFrom: '2027-01-01' },
      ],
    }
    const ps = periodsBetween('2026-09-01', '2027-02-28', rules)
    expect(ps[0].start).toBe('2026-09-01')
    for (let i = 1; i < ps.length; i++) {
      const prevEnd = new Date(`${ps[i - 1].end}T00:00:00Z`)
      prevEnd.setUTCDate(prevEnd.getUTCDate() + 1)
      expect(ps[i].start, `${ps[i - 1].end} then ${ps[i].start}`).toBe(prevEnd.toISOString().slice(0, 10))
    }
    expect(ps.find(p => p.start === '2026-12-03')).toEqual({ start: '2026-12-03', end: '2026-12-31', kind: 'pay_period' })
  })
})

describe('moving the pay period start (5A)', () => {
  it('starts the new dates with the first period nobody submitted; the days between close as one period', () => {
    const plan = anchorMove('2026-10-15', OCT4, '2026-10-08', null)
    expect(plan.effectiveFrom).toBe('2026-10-04')
    expect(plan.oldCurrent).toEqual({ start: '2026-10-04', end: '2026-10-17', kind: 'pay_period' })
    expect(plan.newCurrent).toEqual({ start: '2026-10-08', end: '2026-10-21', kind: 'pay_period' })
    expect(plan.gap).toEqual({ start: '2026-10-04', end: '2026-10-07' })
    expect(plan.moves).toBe(true)
  })

  it('keeps a period someone already submitted', () => {
    const plan = anchorMove('2026-10-15', OCT4, '2026-10-08', '2026-10-17')
    expect(plan.effectiveFrom).toBe('2026-10-18')
    expect(plan.moves).toBe(false)
    expect(plan.newCurrent).toEqual({ start: '2026-10-04', end: '2026-10-17', kind: 'pay_period' })
    expect(plan.gap).toEqual({ start: '2026-10-18', end: '2026-10-21' })
    const after: AnchorChange[] = [...OCT4, { anchor: '2026-10-08', effectiveFrom: '2026-10-18' }]
    expect(gridPeriod('2026-10-01', after)).toEqual({ start: '2026-09-20', end: '2026-10-03', kind: 'pay_period' })
    expect(gridPeriod('2026-10-20', after)).toEqual({ start: '2026-10-18', end: '2026-10-21', kind: 'pay_period' })
    expect(gridPeriod('2026-10-25', after)).toEqual({ start: '2026-10-22', end: '2026-11-04', kind: 'pay_period' })
  })

  it('sets the first start date for every day', () => {
    const plan = anchorMove('2026-10-15', [], '2026-10-04', null)
    expect(plan.effectiveFrom).toBeNull()
    expect(plan.newCurrent).toEqual({ start: '2026-10-04', end: '2026-10-17', kind: 'pay_period' })
  })
})

describe('locked periods (README "Rules" 9)', () => {
  const subs = [
    { start: '2026-10-01', end: '2026-10-31', state: 'submitted' },
    { start: '2026-09-01', end: '2026-09-30', state: 'returned' },
  ]

  it('locks a day in a submitted or approved period, for everyone', () => {
    expect(isLocked('2026-10-15', subs)).toBe(true)
    expect(isLocked('2026-11-01', subs)).toBe(false)
    expect(isLocked('2026-09-15', subs)).toBe(false)
    expect(isLocked('2026-09-15', [{ start: '2026-09-01', end: '2026-09-30', state: 'approved' }])).toBe(true)
  })

  it('locks an entry QuickBooks Time approved or locked, whatever the period says', () => {
    expect(isLocked('2026-09-15', [], 'approved')).toBe(true)
    expect(isLocked('2026-09-15', [], 'locked')).toBe(true)
    expect(isLocked('2026-09-15', [], 'open')).toBe(false)
  })

  it('says which period, in the words of 1N', () => {
    expect(lockedMessage(lockedBy('2026-10-15', subs)!)).toBe('October is submitted. Ask a Super Admin to reopen it.')
    expect(lockedMessage({ start: '2026-10-04', end: '2026-10-17' })).toBe('Oct 4 to 17 is submitted. Ask a Super Admin to reopen it.')
  })
})

describe('periodToSubmit (the Submit button)', () => {
  const monthly: CadenceRules = { changes: [], fallback: 'monthly', anchors: [] }
  const days = (...d: string[]) => new Set(d)

  it('is this month when nothing earlier is waiting', () => {
    expect(periodToSubmit('2026-11-03', monthly, [], days())).toMatchObject({ start: '2026-11-01', end: '2026-11-30' })
  })

  it('is last month while it has Clocky time and was never sent', () => {
    expect(periodToSubmit('2026-11-03', monthly, [], days('2026-10-20'))).toMatchObject({ start: '2026-10-01', end: '2026-10-31' })
  })

  it('moves on once that month is submitted or approved', () => {
    const subs = [{ start: '2026-10-01', end: '2026-10-31', state: 'submitted' }]
    expect(periodToSubmit('2026-11-03', monthly, subs, days('2026-10-20'))).toMatchObject({ start: '2026-11-01' })
    expect(periodToSubmit('2026-11-03', monthly, [{ ...subs[0], state: 'approved' }], days('2026-10-20'))).toMatchObject({ start: '2026-11-01' })
  })

  it('a returned period is waiting again', () => {
    const subs = [{ start: '2026-10-01', end: '2026-10-31', state: 'returned' }]
    expect(periodToSubmit('2026-11-03', monthly, subs, days('2026-10-20'))).toMatchObject({ start: '2026-10-01' })
  })

  it('the oldest first, and never further back than the lookback', () => {
    expect(periodToSubmit('2026-11-03', monthly, [], days('2026-09-10', '2026-10-20'))).toMatchObject({ start: '2026-09-01' })
    expect(periodToSubmit('2026-11-03', monthly, [], days('2017-03-01'))).toMatchObject({ start: '2026-11-01' })
  })
})
