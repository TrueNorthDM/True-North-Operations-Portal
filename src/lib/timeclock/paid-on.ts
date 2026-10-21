/** The Mark paid dialog's day (Invoices.dc.html 6G): written "Nov 3, 2026". Pure. */

export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** "Nov 3, 2026" (or 2026-11-03) to 2026-11-03; null when it is not a day. */
export function parsePaidOn(text: string): string | null {
  const t = text.trim()
  let y: number, m: number, d: number
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  const md = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(t)
  if (iso) { y = +iso[1]; m = +iso[2]; d = +iso[3] }
  else if (md) {
    m = MON.findIndex(x => x.toLowerCase() === md[1].toLowerCase()) + 1
    d = +md[2]; y = +md[3]
    if (!m) return null
  } else return null
  const day = new Date(Date.UTC(y, m - 1, d))
  if (day.getUTCFullYear() !== y || day.getUTCMonth() !== m - 1 || day.getUTCDate() !== d) return null
  return day.toISOString().slice(0, 10)
}

