// Structured, country-agnostic mailing address. Stored as JSON on people.address
// (migration 042). Generic field names (line1/line2/city/state/zip) so the same
// shape holds an address from any country; `country` is an ISO 3166-1 alpha-2 code.

import { countryName } from './countries'
import { flagEmoji } from './phone'

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
