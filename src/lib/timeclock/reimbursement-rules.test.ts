import { describe, expect, it } from 'vitest'
import { CATEGORIES, MEAL_CAP, MEALS_TRAVEL, MILEAGE, mileageAmount, mileageNote, mileageText, milesOf, needsReceipt, overMealCap } from './reimbursement-rules'

describe('reimbursement lines (Tina, 29 October 2026)', () => {
  it('lists the categories in the agreed order', () => {
    expect(CATEGORIES).toEqual(['Internet', 'Software', 'Equipment', 'Travel', 'Mileage', 'Meals while travelling', 'Meals with a client', 'Other'])
  })

  it('works out mileage to the cent', () => {
    expect(mileageAmount(120, 0.76)).toBe(91.2)
    expect(mileageAmount(33.3, 0.76)).toBe(25.31)
    expect(mileageAmount(0.5, 0.655)).toBe(0.33)
    expect(mileageText(120, 0.76)).toBe('120 mi x $0.76 = $91.20')
    expect(mileageNote(120, 0.76)).toBe(' (120 mi at $0.76 a mile)')
  })

  it('reads the miles as typed', () => {
    expect(milesOf('120')).toBe(120)
    expect(milesOf('1,250.25')).toBe(1250.3)
    expect(milesOf('0')).toBeNull()
    expect(milesOf('abc')).toBeNull()
    expect(milesOf('10000')).toBeNull()
  })

  it('needs a receipt for every category but Mileage', () => {
    expect(needsReceipt(MILEAGE)).toBe(false)
    for (const c of CATEGORIES.filter(x => x !== MILEAGE)) expect(needsReceipt(c), c).toBe(true)
  })

  it('caps a meal while travelling at $25, in dollars only', () => {
    expect(MEAL_CAP).toBe(25)
    expect(overMealCap(MEALS_TRAVEL, 25, 'USD')).toBe(false)
    expect(overMealCap(MEALS_TRAVEL, 25.01, 'USD')).toBe(true)
    expect(overMealCap(MEALS_TRAVEL, 3000, 'KES')).toBe(false)
    expect(overMealCap('Meals with a client', 80, 'USD')).toBe(false)
  })
})
