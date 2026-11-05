import { describe, expect, it } from 'vitest'
import { CATEGORIES, DESCRIPTION_LABEL, MEAL_CAP, MEAL_HINT, MEAL_OVER_FLAG, MEAL_OVER_WARNING, MEALS_TRAVEL, MILEAGE, mealReasonMissing, mileageAmount, mileageNote, mileageText, milesOf, needsReceipt, overMealCap, withoutMileageNote } from './reimbursement-rules'

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

  it('flags a meal while travelling over $25, in dollars only', () => {
    expect(MEAL_CAP).toBe(25)
    expect(overMealCap(MEALS_TRAVEL, 25, 'USD')).toBe(false)
    expect(overMealCap(MEALS_TRAVEL, 25.01, 'USD')).toBe(true)
    expect(overMealCap(MEALS_TRAVEL, 3000, 'KES')).toBe(false)
    expect(overMealCap('Meals with a client', 80, 'USD')).toBe(false)
  })

  it('lets a meal over $25 through when the description says why (owner, 5 November 2026)', () => {
    expect(MEAL_HINT).toBe('Meals while travelling are $25 a meal; over that, explain why in the description.')
    expect(MEAL_OVER_WARNING).toBe('This meal is over the $25 limit. Explain why in the description so it can be reviewed.')
    expect(MEAL_OVER_FLAG).toBe('Over the $25 meal limit')
    expect(DESCRIPTION_LABEL).toBe('Description of expense')
    // Under the cap: any description will do.
    expect(mealReasonMissing(MEALS_TRAVEL, 25, 'USD', 'Lunch')).toBe(false)
    // Over it: a few words, not one.
    expect(mealReasonMissing(MEALS_TRAVEL, 38.5, 'USD', 'Dinner')).toBe(true)
    expect(mealReasonMissing(MEALS_TRAVEL, 38.5, 'USD', '  - - ')).toBe(true)
    expect(mealReasonMissing(MEALS_TRAVEL, 38.5, 'USD', 'Dinner with the ASI booth team, no cheaper place open')).toBe(false)
    // Another category or currency has no cap.
    expect(mealReasonMissing('Meals with a client', 120, 'USD', 'Dinner')).toBe(false)
    expect(mealReasonMissing(MEALS_TRAVEL, 3000, 'KES', 'Dinner')).toBe(false)
  })

  it('gives back what a Mileage line\'s person wrote, for an edit', () => {
    expect(withoutMileageNote(`Office to ASI and back${mileageNote(120, 0.76)}`, 120, 0.76)).toBe('Office to ASI and back')
    expect(withoutMileageNote('Office to ASI and back', 120, 0.76)).toBe('Office to ASI and back')
    expect(withoutMileageNote('Uber (20 mi)', null, null)).toBe('Uber (20 mi)')
  })
})
