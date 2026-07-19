// Formats a stored phone number for display in international style with the
// country flag. Stored values are raw-ish (usually the country code + number
// with no leading +, e.g. "5585986839825"), so we prepend a + and let
// libphonenumber-js detect the country from the calling-code prefix and format
// per that country's conventions. Falls back to the raw string when it can't
// be parsed, so a malformed number never disappears from the card.

import { parsePhoneNumberFromString } from 'libphonenumber-js'

export interface FormattedPhone {
  /** Country flag emoji (e.g. the Brazil flag), or null when unknown. */
  flag: string | null
  /** ISO 3166-1 alpha-2 country (e.g. "BR"), or null. */
  country: string | null
  /** International format, e.g. "+55 85 98683 9825". */
  international: string
  /** E.164, e.g. "+5585986839825" (empty string if we only have junk). */
  e164: string
  /** Digits only, no +, for wa.me / tel links. */
  digits: string
  /** Whether the number parsed to a valid phone for its country. */
  valid: boolean
}

/** Turn an ISO 3166-1 alpha-2 code into its flag emoji via regional indicators. */
export function flagEmoji(country: string | null | undefined): string | null {
  if (!country || country.length !== 2) return null
  const cc = country.toUpperCase()
  if (!/^[A-Z]{2}$/.test(cc)) return null
  return String.fromCodePoint(...[...cc].map(c => 0x1f1e6 + c.charCodeAt(0) - 65))
}

export function formatPhone(raw: string | null | undefined): FormattedPhone | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  // Keep only digits and a leading +, then ensure the + so the leading digits
  // are read as a country calling code.
  const cleaned = trimmed.replace(/[^\d+]/g, '')
  const withPlus = cleaned.startsWith('+') ? cleaned : `+${cleaned}`
  const pn = parsePhoneNumberFromString(withPlus)
  if (pn) {
    const country = pn.country ?? null
    return {
      flag: flagEmoji(country),
      country,
      international: pn.formatInternational(),
      e164: pn.number,
      digits: pn.number.replace('+', ''),
      valid: pn.isValid(),
    }
  }
  // Unparseable: show what we have, no flag.
  return { flag: null, country: null, international: trimmed, e164: '', digits: cleaned.replace('+', ''), valid: false }
}
