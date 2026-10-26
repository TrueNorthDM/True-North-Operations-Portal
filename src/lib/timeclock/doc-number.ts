/**
 * Invoice and reimbursement document numbers: prefix, the New York year the
 * number was given, and a running count of at least three digits. The count
 * never restarts: only the year changes (INV-2026-059, then INV-2027-060).
 * The database gives them out (next_document_number, migration 124); this is
 * the same shape for the screens.
 */

/** 7 → "007", 1234 → "1234". */
export function seqText(n: number): string {
  return String(n).padStart(3, '0')
}

/** "INV", 2026, 7 → "INV-2026-007". */
export function docNumber(prefix: string, year: number | string, n: number): string {
  return `${prefix}-${year}-${seqText(n)}`
}

/** "INV-2027-060" → 60; anything else → 0. */
export function seqOf(number: string): number {
  const m = /-(\d+)$/.exec(number)
  return m ? Number(m[1]) : 0
}
