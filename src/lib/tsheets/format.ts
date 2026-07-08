// Canonical money / hours formatting for the i7 Budget Report and its settings.
// One definition so every view renders the same number the same way (previously
// these were copy-pasted across ~6 files with subtly different rounding / zero
// handling — see the audit note for M5-1).

/** "$1,234" — rounds to whole dollars (computed costs can carry cents; budgets
 *  are already whole, so rounding is a no-op there). */
export const money = (n: number): string => '$' + Math.round(n).toLocaleString('en-US')

/** Signed dollars: "−$1,234" when negative (over budget), "$1,234" otherwise. */
export const moneySigned = (n: number): string =>
  (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US')

/** Hours: "—" for 0, whole numbers bare ("5"), otherwise up to 2 decimals with
 *  trailing zeros trimmed ("5.25", "5.5"). */
export const fmtHours = (n: number): string =>
  n === 0 ? '—' : n % 1 === 0 ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
