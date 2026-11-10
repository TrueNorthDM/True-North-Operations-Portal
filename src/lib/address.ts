// Structured, country-agnostic mailing address. Stored as JSON on people.address
// (migration 042). Generic field names (line1/line2/city/state/zip) so the same
// shape holds an address from any country; `country` is an ISO 3166-1 alpha-2 code.

import { countryCode, countryName } from './countries'
import { flagEmoji } from './phone'
import { zoneMatch } from './settings/zone-from-place'
import { zoneLabel } from './agenda/time'

export interface PersonAddress {
  country?: string | null
  zip?: string | null
  line1?: string | null
  line2?: string | null
  city?: string | null
  state?: string | null
}

/** All fields as plain strings (never null) for controlled form inputs. */
export interface AddressForm {
  country: string
  zip: string
  line1: string
  line2: string
  city: string
  state: string
}

export const EMPTY_ADDRESS_FORM: AddressForm = { country: '', zip: '', line1: '', line2: '', city: '', state: '' }

export function toAddressForm(a: PersonAddress | null | undefined): AddressForm {
  return {
    country: a?.country ?? '',
    zip: a?.zip ?? '',
    line1: a?.line1 ?? '',
    line2: a?.line2 ?? '',
    city: a?.city ?? '',
    state: a?.state ?? '',
  }
}

/** Trim a form into a stored address, or null when nothing was entered. */
export function normalizeAddress(f: AddressForm): PersonAddress | null {
  const t = (s: string) => (s.trim() ? s.trim() : undefined)
  const out: PersonAddress = { country: t(f.country), zip: t(f.zip), line1: t(f.line1), line2: t(f.line2), city: t(f.city), state: t(f.state) }
  return Object.values(out).some(Boolean) ? out : null
}

export function isAddressEmpty(a: PersonAddress | null | undefined): boolean {
  if (!a) return true
  return !(a.country || a.zip || a.line1 || a.line2 || a.city || a.state)
}

/** Display lines for a stored address, e.g. ["Rua X, 123", "Fortaleza, CE 60000-000", "Brazil"]. */
export function formatAddressLines(a: PersonAddress | null | undefined): string[] {
  if (!a) return []
  const lines: string[] = []
  if (a.line1) lines.push(a.line1)
  if (a.line2) lines.push(a.line2)
  const cityState = [a.city, a.state].filter(Boolean).join(', ')
  const cityLine = [cityState, a.zip].filter(Boolean).join(' ')
  if (cityLine) lines.push(cityLine)
  const country = countryName(a.country)
  if (country) lines.push(country)
  return lines
}

/** Flag emoji for the address' country, if any. */
export function addressFlag(a: PersonAddress | null | undefined): string | null {
  return flagEmoji(a?.country)
}

/**
 * Where someone lives, short: "Fortaleza, CE, Brazil" (city, state, country
 * name; empty parts skipped). Since 9 November 2026 the address is the only
 * record of where a person lives: the old free-text location is not shown.
 * The country may be stored as a code or, typed by hand, as a name.
 */
export function placeOf(a: PersonAddress | null | undefined): string | null {
  if (!a) return null
  const code = countryCode(a.country)
  const country = code ? countryName(code) : a.country?.trim() || null
  const parts = [a.city?.trim(), a.state?.trim(), country].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}

/** The zone used when the address cannot tell: the company's, New York. */
export const DEFAULT_PERSON_ZONE = 'America/New_York'

export interface AddressZone {
  /** IANA zone; New York when the address cannot tell. */
  zone: string
  /** The country's ISO code, when the address has one that can be read. */
  country: string | null
  /** The address settles the zone: no guess was needed. */
  decided: boolean
  /** What is missing when not decided. */
  missing: 'country' | 'state' | 'known-zone' | null
}

/**
 * A person's time zone, from their address alone (owner, 9 November 2026):
 * the country, then the state and city for the countries with several zones.
 * New York when it cannot tell. Pure.
 */
export function zoneOfAddress(a: PersonAddress | null | undefined): AddressZone {
  const country = countryCode(a?.country)
  if (!country) return { zone: DEFAULT_PERSON_ZONE, country: null, decided: false, missing: 'country' }
  const m = zoneMatch(country, [a?.city, a?.state].filter(Boolean).join(', '))
  if (!m.zone) return { zone: DEFAULT_PERSON_ZONE, country, decided: false, missing: 'known-zone' }
  // A state that names no rule is the country's main zone (Virginia: Eastern); no state at all is a guess.
  const decided = !m.multi || m.byRule || !!a?.state?.trim()
  return { zone: m.zone, country, decided, missing: decided ? null : 'state' }
}

/** "Brasília time (BRT), Fortaleza", or "Eastern time (ET), New York (add the state to set it)". */
export function addressZoneText(a: PersonAddress | null | undefined): string {
  const z = zoneOfAddress(a)
  const label = zoneLabel(z.zone)
  if (z.missing === 'country') return `${label} (add the country to set it)`
  if (z.missing === 'state') return `${label} (add the state to set it)`
  if (z.missing === 'known-zone') return `${label} (the zone of ${countryName(z.country) ?? 'this country'} is not known yet)`
  return label
}
