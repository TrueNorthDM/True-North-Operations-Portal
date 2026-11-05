import { describe, expect, it } from 'vitest'
import { changedFields, keptMileage, readItem, snapshotOf, type ItemRules } from './reimbursement-form'
import { MEALS_TRAVEL, MILEAGE } from './reimbursement-rules'

const RULES: ItemRules = { clients: ['2 - i7 Marketing'], contractor: false, mileageRate: 0.76, today: '2026-11-05' }
const pdf = () => new File(['%PDF-1.4'], 'dinner.pdf', { type: 'application/pdf' })
const fields = (f: Record<string, string | File>) => (k: string) => f[k] ?? null
const base = { category: 'Software', date: '2026-10-30', amount: '45.00', currency: 'USD', purpose: 'Figma, November', client: 'None' }

describe('one receipt, as a new request and an edit check it', () => {
  it('reads a receipt sent with its file', () => {
    const it = readItem(fields({ ...base, receipt: pdf() }), '', RULES)
    expect(it).toMatchObject({ spentOn: '2026-10-30', category: 'Software', amount: 45, currency: 'USD', purpose: 'Figma, November', client: null, billable: false, ext: 'pdf' })
  })

  it('takes the date as people type it, 10/1/2026 included (owner, 5 November 2026)', () => {
    expect(readItem(fields({ ...base, date: '10/1/2026', receipt: pdf() }), '', RULES)).toMatchObject({ spentOn: '2026-10-01' })
    expect(readItem(fields({ ...base, date: 'Oct 1, 2026', receipt: pdf() }), '', RULES)).toMatchObject({ spentOn: '2026-10-01' })
    expect(readItem(fields({ ...base, date: '31/10/2026', receipt: pdf() }), 'Receipt 2: ', RULES)).toBe('Receipt 2: write the date of the expense, like 10/31/2026 or Oct 31, 2026.')
    expect(readItem(fields({ ...base, date: '11/6/2026', receipt: pdf() }), '', RULES)).toBe('the expense date cannot be after today.')
  })

  it('needs the file, unless one is already stored (an edit) or it is Mileage', () => {
    expect(readItem(fields(base), '', RULES)).toBe('add the receipt: a photo or a PDF.')
    expect(readItem(fields(base), '', RULES, true)).toMatchObject({ file: null, amount: 45 })
    expect(readItem(fields({ ...base, category: MILEAGE, miles: '120', purpose: 'Office to ASI' }), '', RULES)).toMatchObject({ amount: 91.2, purpose: 'Office to ASI (120 mi at $0.76 a mile)', miles: 120, rate: 0.76 })
  })

  it('sends a meal over $25 for review when the description says why', () => {
    const meal = { ...base, category: MEALS_TRAVEL, amount: '38.50', receipt: pdf() }
    expect(readItem(fields({ ...meal, purpose: 'Dinner' }), '', RULES)).toBe('this meal is over the $25 limit: explain why in the description, in a few words.')
    expect(readItem(fields({ ...meal, purpose: 'Dinner at the hotel, nothing else open' }), '', RULES)).toMatchObject({ amount: 38.5, category: MEALS_TRAVEL })
    expect(readItem(fields({ ...meal, amount: '22', purpose: 'Dinner' }), '', RULES)).toMatchObject({ amount: 22 })
  })

  it('asks for the description by its name', () => {
    expect(readItem(fields({ ...base, purpose: ' ', receipt: pdf() }), '', RULES)).toBe('write the description of the expense.')
  })
})

describe('what an edit keeps in the history', () => {
  const row = { spent_on: '2026-10-30', category: 'Software', amount: '45.00', currency: 'USD', purpose: 'Figma', client: null, billable: false, miles: null, receipt_number: 'RCT-2026-005', receipt_name: 'figma.pdf' }
  it('lists only the fields that changed', () => {
    const before = snapshotOf(row)
    expect(changedFields(before, snapshotOf({ ...row, amount: 45 }))).toEqual([])
    expect(changedFields(before, snapshotOf({ ...row, amount: 48, purpose: 'Figma, two seats' }))).toEqual(['amount', 'purpose'])
    expect(changedFields(before, snapshotOf({ ...row, receipt_number: 'RCT-2026-009', receipt_name: 'figma-2.pdf' }))).toEqual(['receipt_number', 'receipt_name'])
  })
})

describe('amounts and mileage on an edit (audit, 5 November 2026)', () => {
  it('refuses an amount that is not a plain number, or rounds to nothing', () => {
    for (const amount of ['1e3', '0.004', '12.345', 'Infinity']) {
      expect(readItem(fields({ ...base, amount, receipt: pdf() }), '', RULES), amount).toBe('write the amount, like 35.00.')
    }
  })

  const stored = { category: MILEAGE, amount: '84.00', miles: '120.0', mileage_rate: '0.700' }
  const mileage = (miles: string) => fields({ ...base, category: MILEAGE, miles, purpose: 'Office to ASI (120 mi at $0.70 a mile)' })

  it('keeps the stored rate and amount of a Mileage line whose miles did not change', () => {
    expect(keptMileage(stored, 120)).toEqual({ rate: 0.7, amount: 84 })
    expect(readItem(mileage('120'), '', RULES, false, stored)).toMatchObject({ amount: 84, rate: 0.7, miles: 120, purpose: 'Office to ASI (120 mi at $0.70 a mile)' })
  })

  it('works out a new or changed Mileage line at today\'s rate', () => {
    expect(keptMileage(stored, 130)).toBeNull()
    expect(readItem(fields({ ...base, category: MILEAGE, miles: '130', purpose: 'Office to ASI' }), '', RULES, false, stored)).toMatchObject({ amount: 98.8, rate: 0.76 })
    expect(readItem(fields({ ...base, category: MILEAGE, miles: '120', purpose: 'Office to ASI' }), '', RULES)).toMatchObject({ amount: 91.2, rate: 0.76 })
    expect(keptMileage({ category: 'Software', amount: 45, miles: null, mileage_rate: null }, 120)).toBeNull()
  })
})
