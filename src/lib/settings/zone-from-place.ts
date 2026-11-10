/**
 * A person's time zone worked out from where they live (owner, 6 November
 * 2026: someone in Fortaleza saw New York's time on Home). Since 9 November
 * 2026 the address on their Directory profile is the only source: nobody picks
 * a zone in Settings any more (zoneOfAddress in lib/address.ts). Pure and tested.
 *
 * A country with one time zone has it; the US, Brazil, Canada and Mexico are
 * read by their state or province (and city); anything not recognised stays
 * null, and the caller keeps New York.
 */

const ONE_ZONE: Record<string, string> = {
  KE: 'Africa/Nairobi', TZ: 'Africa/Dar_es_Salaam', RW: 'Africa/Kigali', UG: 'Africa/Kampala', NG: 'Africa/Lagos',
  ET: 'Africa/Addis_Ababa', GH: 'Africa/Accra', ZA: 'Africa/Johannesburg', ZM: 'Africa/Lusaka', ZW: 'Africa/Harare',
  MW: 'Africa/Blantyre', BI: 'Africa/Bujumbura', CD: 'Africa/Kinshasa', VE: 'America/Caracas', CO: 'America/Bogota',
  PE: 'America/Lima', AR: 'America/Argentina/Buenos_Aires', CL: 'America/Santiago', EC: 'America/Guayaquil',
  PH: 'Asia/Manila', IN: 'Asia/Kolkata', PK: 'Asia/Karachi', GB: 'Europe/London', IE: 'Europe/Dublin',
  PT: 'Europe/Lisbon', ES: 'Europe/Madrid', FR: 'Europe/Paris', DE: 'Europe/Berlin', IT: 'Europe/Rome',
  NL: 'Europe/Amsterdam', JM: 'America/Jamaica', DO: 'America/Santo_Domingo', GT: 'America/Guatemala',
  HN: 'America/Tegucigalpa', SV: 'America/El_Salvador', NI: 'America/Managua', CR: 'America/Costa_Rica',
  PA: 'America/Panama', PR: 'America/Puerto_Rico', PY: 'America/Asuncion', UY: 'America/Montevideo', BO: 'America/La_Paz',
  NZ: 'Pacific/Auckland', JP: 'Asia/Tokyo',
}

// US states by name and by code: Eastern, Central, Mountain, Pacific, and the ones that keep their own.
const US: [RegExp, string][] = [
  [/\b(alaska|ak)\b/, 'America/Anchorage'],
  [/\b(hawaii|hi)\b/, 'Pacific/Honolulu'],
  [/\b(arizona|az)\b/, 'America/Phoenix'],
  [/\b(california|ca|oregon|or|washington|wa|nevada|nv)\b/, 'America/Los_Angeles'],
  [/\b(colorado|co|montana|mt|utah|ut|wyoming|wy|new mexico|nm|idaho|id)\b/, 'America/Denver'],
  [/\b(texas|tx|illinois|il|wisconsin|wi|minnesota|mn|iowa|ia|missouri|mo|arkansas|ar|louisiana|la|mississippi|ms|alabama|al|oklahoma|ok|kansas|ks|nebraska|ne|south dakota|sd|north dakota|nd|tennessee|tn)\b/, 'America/Chicago'],
]

const BR: [RegExp, string][] = [
  [/\b(ceará|ceara|ce|rio grande do norte|rn|paraíba|paraiba|pb|piauí|piaui|pi|maranhão|maranhao|ma)\b/, 'America/Fortaleza'],
  [/\b(pernambuco|pe)\b/, 'America/Recife'],
  [/\b(bahia|ba)\b/, 'America/Bahia'],
  [/\b(alagoas|al|sergipe|se)\b/, 'America/Maceio'],
  [/\b(pará|para|pa|amapá|amapa|ap)\b/, 'America/Belem'],
  [/\b(amazonas|am|roraima|rr|rondônia|rondonia|ro)\b/, 'America/Manaus'],
  [/\b(acre|ac)\b/, 'America/Rio_Branco'],
  [/\b(mato grosso do sul|ms)\b/, 'America/Campo_Grande'],
  [/\b(mato grosso|mt)\b/, 'America/Cuiaba'],
]

const CA: [RegExp, string][] = [
  [/\b(british columbia|bc|yukon|yt)\b/, 'America/Vancouver'],
  [/\b(alberta|ab|northwest territories|nt)\b/, 'America/Edmonton'],
  [/\b(saskatchewan|sk)\b/, 'America/Regina'],
  [/\b(manitoba|mb)\b/, 'America/Winnipeg'],
  [/\b(nova scotia|ns|new brunswick|nb|prince edward island|pe)\b/, 'America/Halifax'],
  [/\b(newfoundland|nl)\b/, 'America/St_Johns'],
]

const MX: [RegExp, string][] = [
  [/\b(nuevo le[oó]n|tamaulipas|coahuila)\b/, 'America/Monterrey'],
  [/\b(baja california sur|sinaloa|nayarit)\b/, 'America/Mazatlan'],
  [/\b(sonora)\b/, 'America/Hermosillo'],
  [/\b(baja california|tijuana)\b/, 'America/Tijuana'],
  [/\b(quintana roo|canc[uú]n)\b/, 'America/Cancun'],
  [/\b(chihuahua)\b/, 'America/Chihuahua'],
]

// A word's edges that know accented letters (\b does not: "Ceará" has none after the "á").
const word = (re: RegExp) => new RegExp(re.source.replace(/^\\b/, '(?<!\\p{L})').replace(/\\b$/, '(?!\\p{L})'), 'u')
const matchOf = (rules: [RegExp, string][], text: string) => rules.find(([re]) => word(re).test(text))?.[1] ?? null

/** The countries with more than one zone: their rules, and the zone when no rule matches. */
const MULTI: Record<string, { rules: [RegExp, string][]; fallback: string }> = {
  US: { rules: US, fallback: 'America/New_York' },
  BR: { rules: BR, fallback: 'America/Sao_Paulo' },
  CA: { rules: CA, fallback: 'America/Toronto' },
  MX: { rules: MX, fallback: 'America/Mexico_City' },
}

/**
 * The zone and how it was found: `multi` when the country has several zones,
 * `byRule` when the place named one of them (otherwise the country's main one
 * was taken).
 */
export function zoneMatch(country: string | null, place: string | null | undefined): { zone: string | null; multi: boolean; byRule: boolean } {
  if (!country) return { zone: null, multi: false, byRule: false }
  let text = ` ${(place ?? '').toLowerCase()} `
  const m = MULTI[country]
  if (!m) return { zone: ONE_ZONE[country] ?? null, multi: false, byRule: false }
  // The state is the part before the country: "Beaverton, OR, USA" reads OR, not the "us".
  if (country === 'US') text = text.replace(/,\s*(usa|us|united states)\s*$/, ' ')
  const hit = matchOf(m.rules, text)
  return { zone: hit ?? m.fallback, multi: true, byRule: !!hit }
}

/**
 * `country` is the ISO code (countryCode in lib/countries.ts); `place` is the
 * city and state of the address, in one string.
 */
export function zoneFromPlace(country: string | null, place: string | null | undefined): string | null {
  return zoneMatch(country, place).zone
}
