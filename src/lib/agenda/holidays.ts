/**
 * National holidays on the Agenda (owner, 2026-10-23): the US ones are the
 * company holidays (calendar.ts, they change time off and work days); the other
 * countries' are only shown. Each person sees the US and the country they live
 * in; Super Admins and Admins see every country someone at True North lives in.
 *
 * The other countries come from the date-holidays package (code ISC, holiday
 * data CC-BY 3.0, credited on the Agenda), public holidays only, in English.
 */

import Holidays from 'date-holidays'

const ALIASES: Record<string, string> = {
  usa: 'US', 'u.s.': 'US', 'u.s.a.': 'US', 'united states of america': 'US', america: 'US',
  uk: 'GB', 'u.k.': 'GB', england: 'GB', scotland: 'GB', wales: 'GB', 'great britain': 'GB',
}

let names: Map<string, string> | null = null
/** Country name (and the usual short forms) -> ISO code, lower case. */
function nameIndex(): Map<string, string> {
  if (names) return names
  const m = new Map<string, string>()
  for (const [code, name] of Object.entries(new Holidays().getCountries('en'))) m.set(name.toLowerCase(), code)
  for (const [k, v] of Object.entries(ALIASES)) m.set(k, v)
  names = m
  return m
}

/** Where a person lives: the address country, else the last part of the location ("Nairobi, Kenya"). */
export function countryOf(address: { country?: string | null } | null | undefined, location: string | null | undefined): string | null {
  const code = address?.country?.trim().toUpperCase()
  if (code && /^[A-Z]{2}$/.test(code)) return code
  const last = location?.split(',').at(-1)?.trim().toLowerCase()
  if (!last) return null
  if (/^[a-z]{2}$/.test(last) && last !== 'us' && new Holidays().getCountries('en')[last.toUpperCase()]) return last.toUpperCase()
  return nameIndex().get(last) ?? (last === 'us' ? 'US' : null)
}

/** A country's public holidays between two days: day -> name. */
export function nationalHolidays(country: string, from: string, to: string): Map<string, string> {
  const out = new Map<string, string>()
  // A country the package does not know (a typo in an address) shows nothing, rather than breaking the Agenda.
  let hd: Holidays
  try { hd = new Holidays(country, { languages: ['en'] }) } catch { return out }
  if (!hd.getCountries('en')[country]) return out
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
    for (const h of hd.getHolidays(y) || []) {
      const d = h.date.slice(0, 10)
      if (h.type === 'public' && d >= from && d <= to && !out.has(d)) out.set(d, h.name)
    }
  }
  return out
}
