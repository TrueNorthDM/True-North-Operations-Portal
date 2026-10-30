/**
 * What a reimbursement line may ask for (Tina's review, 29 October 2026: the
 * portal replaces her Drive spreadsheet, which has a mileage block, miles
 * times the rate with no receipt, and meals while travelling at $25 a meal).
 * The form and the route that stores a request both decide with these, so
 * they never disagree. Pure.
 */

export const MILEAGE = 'Mileage'
export const MEALS_TRAVEL = 'Meals while travelling'

export const CATEGORIES = ['Internet', 'Software', 'Equipment', 'Travel', MILEAGE, MEALS_TRAVEL, 'Meals with a client', 'Other']

/** The most a meal while travelling is paid, in US dollars. */
export const MEAL_CAP = 25
export const MEAL_HINT = 'Meals while travelling are $25 a meal at most. Meals at a conference or event are already paid for.'

/** The company's rate when none is set (Company settings > Invoices). */
export const DEFAULT_MILEAGE_RATE = 0.76

/** Every category needs its receipt but Mileage: the miles are the proof. */
export const needsReceipt = (category: string): boolean => category !== MILEAGE

/** The amount of a mileage line, in US dollars, rounded to the cent. */
export function mileageAmount(miles: number, rate: number): number {
  return Math.round(miles * rate * 100) / 100
}

const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}`
const mi = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 })

/** "120 mi x $0.76 = $91.20", shown as the miles are typed. */
export const mileageText = (miles: number, rate: number): string => `${mi(miles)} mi x ${usd(rate)} = ${usd(mileageAmount(miles, rate))}`

/** Added to what it was for, so invoices and documents show it: " (120 mi at $0.76 a mile)". */
export const mileageNote = (miles: number, rate: number): string => ` (${mi(miles)} mi at ${usd(rate)} a mile)`

/** Miles as typed: a number over 0 and under 10,000, at most one decimal; else null. */
export function milesOf(raw: string): number | null {
  const n = Number(String(raw).replace(/,/g, '').trim())
  return n > 0 && n < 10_000 ? Math.round(n * 10) / 10 : null
}

/** A meal while travelling over the cap (US dollars only; another currency has no cap). */
export const overMealCap = (category: string, amount: number, currency: string): boolean =>
  category === MEALS_TRAVEL && currency === 'USD' && amount > MEAL_CAP
