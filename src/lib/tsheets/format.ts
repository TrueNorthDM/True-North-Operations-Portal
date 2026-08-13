// Canonical money / hours formatting for the i7 Budget Report and its settings.
// One definition so every view renders the same number the same way (previously
// these were copy-pasted across ~6 files with subtly different rounding / zero
// handling, see the audit note for M5-1).

/**
 * "$1,234.56". Always two decimals, because this is what a client invoice is
 * reconciled against.
 *
 * It used to round to whole dollars, on the reasoning that budgets are whole
 * anyway. Accounting caught it on the July invoice: the report computed
 * $11,251.25, $498.75, $4,156.25 and $27,977.50, which is exactly right, and
 * displayed $11,251, $499, $4,156 and $27,978. Adding up what was on the screen
 * came to fifty cents more than the real total, and a client's accounting
 * department flags that.
 *
 * The arithmetic behind it was never wrong. Only the last step was, which is
 * the kind of bug that survives longest: every internal number agreed with
 * every other internal number.
 */
export const money = (n: number): string =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Signed dollars: "−$1,234.56" when negative (over budget). */
export const moneySigned = (n: number): string =>
  (n < 0 ? '−$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Hours: "-" for 0, whole numbers bare ("5"), otherwise up to 2 decimals with
 *  trailing zeros trimmed ("5.25", "5.5"). */
export const fmtHours = (n: number): string =>
  n === 0 ? '-' : n % 1 === 0 ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')
