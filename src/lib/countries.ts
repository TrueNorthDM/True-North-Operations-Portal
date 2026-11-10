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

// The usual short forms people type for a country, lower case.
const ALIASES: Record<string, string> = {
  usa: 'US', us: 'US', 'u.s.': 'US', 'u.s.a.': 'US', 'united states of america': 'US', america: 'US',
  uk: 'GB', 'u.k.': 'GB', england: 'GB', scotland: 'GB', wales: 'GB', 'great britain': 'GB',
  brasil: 'BR',
}

let byName: Map<string, string> | null = null

/**
 * The ISO code of a country typed as a code ("br") or as a name ("Brazil",
 * "USA", "United Kingdom"). Null when it cannot be read (owner, 9 November
 * 2026: the address is where someone lives, and some were typed by name).
 */
export function countryCode(value: string | null | undefined): string | null {
  const v = value?.trim()
  if (!v) return null
  const known = new Set(allCountries().map(c => c.code))
  if (/^[a-z]{2}$/i.test(v) && known.has(v.toUpperCase())) return v.toUpperCase()
  if (!byName) {
    byName = new Map(allCountries().map(c => [c.name.toLowerCase(), c.code]))
    for (const [k, code] of Object.entries(ALIASES)) byName.set(k, code)
  }
  return byName.get(v.toLowerCase()) ?? null
}
