/**
 * A day as people write it: the Mark paid dialog's (Invoices.dc.html 6G) and a
 * reimbursement's date of the expense. Shown "Nov 3, 2026"; typed that way, as
 * 2026-11-03, or as numbers the US way, 11/3/2026 or 11/3/26 (Tina, owner,
 * 5 November 2026: "10/1/2026" was refused). Pure.
 */

export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** What a refused day says, wherever one is typed. */
export const DAY_HINT = 'Write the date of the expense, like 10/31/2026 or Oct 31, 2026.'

/** "Nov 3, 2026", 2026-11-03, 11/3/2026 or 11/3/26 to 2026-11-03; null when it is not a day. */
export function parsePaidOn(text: string): string | null {
  const t = text.trim()
  let y: number, m: number, d: number
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  const md = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(t)
  // Month first, as in the US; a two-digit year is this century's.
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(t)
  if (iso) { y = +iso[1]; m = +iso[2]; d = +iso[3] }
  else if (us) { m = +us[1]; d = +us[2]; y = us[3].length === 2 ? 2000 + +us[3] : +us[3] }
  else if (md) {
    m = MON.findIndex(x => x.toLowerCase() === md[1].toLowerCase()) + 1
    d = +md[2]; y = +md[3]
    if (!m) return null
  } else return null
  const day = new Date(Date.UTC(y, m - 1, d))
  if (day.getUTCFullYear() !== y || day.getUTCMonth() !== m - 1 || day.getUTCDate() !== d) return null
  return day.toISOString().slice(0, 10)
}

