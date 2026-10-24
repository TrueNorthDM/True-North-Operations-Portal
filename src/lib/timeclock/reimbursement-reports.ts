/**
 * Reimbursement requests with several receipts (migration 122): the words the
 * request, Approvals and the bell use for them. Pure, so it is tested alone.
 */

export interface Amount { amount: number; currency: string }

const fmt = (n: number, currency: string) => (currency === 'USD'
  ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  : `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`)

/** "$873.00", or "$790.40 and 1,200.00 KES" when the receipts are in more than one currency (dollars first). */
export function totalsText(items: readonly Amount[]): string {
  const sums = new Map<string, number>()
  for (const it of items) sums.set(it.currency, (sums.get(it.currency) ?? 0) + Math.round(it.amount * 100))
  const order = [...sums.keys()].sort((a, b) => (a === 'USD' ? -1 : b === 'USD' ? 1 : a.localeCompare(b)))
  const parts = order.map(cur => fmt(sums.get(cur)! / 100, cur))
  return parts.length <= 1 ? parts[0] ?? fmt(0, 'USD') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
}

/** "4 receipts" */
export const receiptsText = (n: number): string => `${n} receipt${n === 1 ? '' : 's'}`

/** "São Paulo trip, 4 receipts", or "4 receipts" with no name. */
export const reportTitle = (name: string | null | undefined, n: number): string => (name?.trim() ? `${name.trim()}, ${receiptsText(n)}` : receiptsText(n))

/** What a decision on a request with several receipts comes to: "Approved 3, denied 1." */
export function decisionText(approved: number, denied: number): string {
  if (!denied) return approved === 1 ? 'Approved.' : `Approved all ${approved}.`
  if (!approved) return denied === 1 ? 'Denied.' : `Denied all ${denied}.`
  return `Approved ${approved}, denied ${denied}.`
}
