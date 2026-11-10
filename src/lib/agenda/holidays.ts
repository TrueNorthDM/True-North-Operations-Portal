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
import { countryCode } from '@/lib/countries'

let names: Map<string, string> | null = null
/** Country name, as the holiday package says it -> ISO code, lower case. */
function nameIndex(): Map<string, string> {
  if (names) return names
  names = new Map(Object.entries(new Holidays().getCountries('en')).map(([code, name]) => [name.toLowerCase(), code]))
  return names
}

/**
 * Where a person lives: the country of their address (owner, 9 November 2026:
 * the address is the only source; the old location is not read). The form
 * stores the ISO code; one typed by hand as a name ("Brazil", "USA") is read too.
 */
export function countryOf(address: { country?: string | null } | null | undefined): string | null {
  return countryCode(address?.country) ?? nameIndex().get(address?.country?.trim().toLowerCase() ?? '') ?? null
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
