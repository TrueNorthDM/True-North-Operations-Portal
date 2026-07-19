// Country list for the address picker: every country libphonenumber knows,
// paired with its English display name (via Intl.DisplayNames, built into the
// runtime) and flag emoji. Works for addresses in any country, no hardcoded
// table to maintain. The list is built once and cached.

import { getCountries } from 'libphonenumber-js'
import { flagEmoji } from './phone'

export interface CountryOption {
  /** ISO 3166-1 alpha-2, e.g. "BR". */
  code: string
  name: string
  flag: string | null
}

function regionNames(): Intl.DisplayNames | null {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' })
  } catch {
    return null
  }
}

let cache: CountryOption[] | null = null

export function allCountries(): CountryOption[] {
  if (cache) return cache
  const dn = regionNames()
  cache = getCountries()
    .map(code => ({ code, name: dn?.of(code) ?? code, flag: flagEmoji(code) }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return cache
}

/** Human-readable country name for an ISO code (falls back to the code). */
export function countryName(code: string | null | undefined): string | null {
  if (!code) return null
  return regionNames()?.of(code) ?? code
}
