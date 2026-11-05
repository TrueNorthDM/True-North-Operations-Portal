/**
 * One receipt of a reimbursement request as the form sends it (numbered
 * fields: receipt_0, date_0, category_0, ...), checked the same way whether the
 * request is new (reimbursements/new/route.ts) or a waiting one being edited
 * (reimbursements/edit/route.ts, owner, 5 November 2026: "same validation as a
 * new request"). Pure: no reads, no writes; the routes store what passes.
 *
 * Tina's review (29 October 2026): a Mileage line has miles instead of an
 * amount (miles times the company's rate, worked out here, never taken from
 * the form) and needs no receipt. Owner, 5 November 2026: a meal while
 * travelling over $25 goes through for review, with a description that says
 * why; the date may be typed as 10/1/2026.
 */

import { parsePaidOn } from './paid-on'
import { amountOf, CATEGORIES, MEAL_REASON_ERROR, MILEAGE, mealReasonMissing, mileageAmount, mileageNote, milesOf, needsReceipt, withoutMileageNote } from './reimbursement-rules'

export const RECEIPT_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/heif': 'heif', 'image/webp': 'webp', 'application/pdf': 'pdf' }
export const MAX_RECEIPT = 10 * 1024 * 1024
/** The server takes bodies up to 50 MB; a request stays under it. */
export const MAX_TOTAL = 45 * 1024 * 1024
export const MAX_RECEIPTS = 20

export interface RmbItem {
  /** A new file for this receipt, or null (kept, or a Mileage line with none). */
  file: File | null
  ext: string
  spentOn: string
  category: string
  amount: number
  currency: string
  /** The description of the expense, with the mileage note added for a Mileage line. */
  purpose: string
  client: string | null
  billable: boolean
  miles: number | null
  rate: number | null
}

export interface ItemRules {
  clients: readonly string[]
  /** A contractor's receipts go on a USD invoice, so they come in dollars (owner, 24 October 2026). */
  contractor: boolean
  mileageRate: number
  /** Today, YYYY-MM-DD in the person's zone: an expense is never after it. */
  today: string
}

/** A receipt as stored, when an edit changes it: what a Mileage line keeps when its miles did not change. */
export interface StoredLine {
  category: string
  amount: number | string
  miles?: number | string | null
  mileage_rate?: number | string | null
}

/**
 * One receipt's fields, or the refusal's words. `n` starts each refusal
 * ("Receipt 2: "); `stored` says a receipt file is already kept for it (an
 * edit), so a new one is not needed. `prev`, on an edit, is the receipt as
 * stored: a Mileage line whose miles did not change keeps its rate and amount
 * (audit, 5 November 2026); a new or changed one is worked out at today's rate.
 */
export function readItem(get: (k: string) => FormDataEntryValue | null, n: string, rules: ItemRules, stored = false, prev: StoredLine | null = null): RmbItem | string {
  const category = String(get('category') ?? '')
  if (!CATEGORIES.includes(category)) return `${n}pick a category.`
  // Every category needs its receipt but Mileage, where a receipt is optional.
  const sent = get('receipt')
  const file = sent && typeof sent === 'object' && 'size' in sent && sent.size ? sent as File : null
  if (!file && !stored && needsReceipt(category)) return `${n}add the receipt: a photo or a PDF.`
  let ext = ''
  if (file) {
    if (file.size > MAX_RECEIPT) return `${n}the receipt is over 10 MB. Send a smaller photo or PDF.`
    ext = RECEIPT_TYPES[file.type] ?? ''
    if (!ext) return `${n}the receipt must be a photo (JPG, PNG, HEIC) or a PDF.`
  }
  // The form sends 2026-10-01; a day typed as people write it is read too.
  const spentOn = parsePaidOn(String(get('date') ?? ''))
  if (!spentOn) return `${n}write the date of the expense, like 10/31/2026 or Oct 31, 2026.`
  if (spentOn > rules.today) return `${n}the expense date cannot be after today.`
  // A Mileage line keeps room for the miles and rate added to it.
  let purpose = String(get('purpose') ?? '').trim().slice(0, category === MILEAGE ? 440 : 500)
  if (!purpose) return `${n}write the description of the expense.`
  let amount: number, currency: string, miles: number | null = null, rate: number | null = null
  if (category === MILEAGE) {
    // The amount is worked out here from the miles and the company's rate, in dollars.
    miles = milesOf(String(get('miles') ?? ''))
    if (miles == null) return `${n}write the miles, like 120.`
    const kept = keptMileage(prev, miles)
    rate = kept?.rate ?? rules.mileageRate
    amount = kept?.amount ?? mileageAmount(miles, rate)
    currency = 'USD'
    // The note the portal added is written again, never twice.
    purpose = withoutMileageNote(purpose, miles, rate).trim() || purpose
    purpose += mileageNote(miles, rate)
  } else {
    const typed = amountOf(String(get('amount') ?? ''))
    if (typed == null) return `${n}write the amount, like 35.00.`
    amount = typed
    currency = String(get('currency') ?? 'USD').toUpperCase()
    if (!/^[A-Z]{3}$/.test(currency)) return `${n}pick the currency.`
    if (rules.contractor && currency !== 'USD') return `${n}write the amount in US dollars: your invoice is in USD.`
    // Over the $25 a meal: it goes, for review, when the description says why (owner, 5 November 2026).
    if (mealReasonMissing(category, amount, currency, purpose)) return `${n}${MEAL_REASON_ERROR}`
  }
  const clientRaw = String(get('client') ?? '').trim()
  const client = clientRaw && clientRaw !== 'None' ? clientRaw : null
  if (client && !rules.clients.includes(client)) return `${n}pick a client or project from the list.`
  return { file, ext, spentOn, category, amount: Math.round(amount * 100) / 100, currency, purpose, client, billable: !!client && get('billable') === 'yes', miles, rate }
}

/** The stored rate and amount of a Mileage line whose miles are the same; null when it is new or its miles changed. */
export function keptMileage(prev: StoredLine | null, miles: number): { rate: number; amount: number } | null {
  if (!prev || prev.category !== MILEAGE || prev.miles == null || prev.mileage_rate == null) return null
  const rate = Number(prev.mileage_rate), amount = Number(prev.amount)
  if (Number(prev.miles) !== miles || !(rate > 0) || !(amount > 0)) return null
  return { rate, amount }
}

/** What the change history keeps of a receipt: its values, before or after (migration 153). */
export interface RmbSnapshot {
  spent_on: string; category: string; amount: number; currency: string; purpose: string
  client: string | null; billable: boolean; miles: number | null
  receipt_number: string | null; receipt_name: string | null
}

export function snapshotOf(r: { spent_on: string; category: string; amount: number | string; currency: string; purpose: string; client: string | null; billable: boolean; miles?: number | string | null; receipt_number?: string | null; receipt_name?: string | null }): RmbSnapshot {
  return {
    spent_on: r.spent_on, category: r.category, amount: Number(r.amount), currency: r.currency, purpose: r.purpose,
    client: r.client, billable: r.billable, miles: r.miles == null ? null : Number(r.miles),
    receipt_number: r.receipt_number ?? null, receipt_name: r.receipt_name ?? null,
  }
}

/** The fields that differ between two snapshots, in a stable order; none when it was saved as it was. */
export function changedFields(before: RmbSnapshot, after: RmbSnapshot): (keyof RmbSnapshot)[] {
  return (Object.keys(before) as (keyof RmbSnapshot)[]).filter(k => before[k] !== after[k])
}
