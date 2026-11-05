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

/**
 * A meal while travelling is $25 (owner, 5 November 2026, from Tina's feedback):
 * over that, the request still goes, for its decider to review, and the
 * description must say why.
 */
export const MEAL_CAP = 25
export const MEAL_HINT = 'Meals while travelling are $25 a meal; over that, explain why in the description.'
/** Under a meal over the $25, in the form (portal and /send). */
export const MEAL_OVER_WARNING = 'This meal is over the $25 limit. Explain why in the description so it can be reviewed.'
/** What the decider sees on that receipt in Approvals. */
export const MEAL_OVER_FLAG = 'Over the $25 meal limit'
/** The form's field for what the expense was (owner, 5 November 2026); the column is still `purpose`. */
export const DESCRIPTION_LABEL = 'Description of expense'
/** Words a description of a meal over the $25 needs, so it explains why. */
export const MEAL_REASON_WORDS = 3

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

/** A plain decimal as people type it: digits, thousands commas, an optional dot. Never "1e3", "0x10" or "Infinity". */
const PLAIN_DECIMAL = /^(\d+(\.\d*)?|\.\d+)$/

/** Miles as typed: a plain number, rounded to one decimal, then over 0 and under 10,000; else null. */
export function milesOf(raw: string): number | null {
  const t = String(raw ?? '').replace(/,/g, '').trim()
  if (!PLAIN_DECIMAL.test(t)) return null
  const n = Math.round(Number(t) * 10) / 10
  return n > 0 && n < 10_000 ? n : null
}

/** Money as typed: a plain number with at most 2 decimals, rounded to the cent, then over 0 and under 100,000; else null. */
export function amountOf(raw: string): number | null {
  const t = String(raw ?? '').replace(/,/g, '').trim()
  if (!PLAIN_DECIMAL.test(t) || /\.\d{3,}$/.test(t)) return null
  const n = Math.round(Number(t) * 100) / 100
  return n > 0 && n < 100_000 ? n : null
}

/** A meal while travelling over the cap (US dollars only; another currency has no cap): allowed, flagged for review. */
export const overMealCap = (category: string, amount: number, currency: string): boolean =>
  category === MEALS_TRAVEL && currency === 'USD' && amount > MEAL_CAP

const words = (text: string) => text.trim().split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w)).length

/** A meal over the cap whose description is too short to say why (form and server alike). */
export const mealReasonMissing = (category: string, amount: number, currency: string, description: string): boolean =>
  overMealCap(category, amount, currency) && words(description) < MEAL_REASON_WORDS

/** The refusal when it is missing. */
export const MEAL_REASON_ERROR = 'this meal is over the $25 limit: explain why in the description, in a few words.'

/** What a Mileage line's person wrote, without the " (120 mi at $0.76 a mile)" the portal added: what an edit starts from. */
export function withoutMileageNote(purpose: string, miles: number | null, rate: number | null): string {
  if (miles == null || rate == null) return purpose
  const note = mileageNote(Number(miles), Number(rate))
  return purpose.endsWith(note) ? purpose.slice(0, -note.length) : purpose
}
