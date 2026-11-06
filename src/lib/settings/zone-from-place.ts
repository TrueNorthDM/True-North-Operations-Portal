/**
 * A person's time zone worked out from where they live, for anyone who has not
 * picked one in Settings (owner, 6 November 2026: someone in Fortaleza saw New
 * York's time on Home). Settings still wins; this only replaces the New York
 * default. Pure and tested.
 *
 * A country with one time zone has it; the US, Brazil, Canada and Mexico are
 * read by their state or province in the address or the location; anything
 * not recognised stays null, and the caller keeps New York.
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
const pick = (rules: [RegExp, string][], text: string, fallback: string) => rules.find(([re]) => word(re).test(text))?.[1] ?? fallback

/**
 * `country` is the ISO code (countryOf in lib/agenda/holidays.ts); `place` is
 * the location and any state from the address, in one string.
 */
export function zoneFromPlace(country: string | null, place: string | null | undefined): string | null {
  if (!country) return null
  const text = ` ${(place ?? '').toLowerCase()} `
  switch (country) {
    // The state is the part before the country: "Beaverton, OR, USA" reads OR, not the "us".
    case 'US': return pick(US, text.replace(/,\s*(usa|us|united states)\s*$/, ' '), 'America/New_York')
    case 'BR': return pick(BR, text, 'America/Sao_Paulo')
    case 'CA': return pick(CA, text, 'America/Toronto')
    case 'MX': return pick(MX, text, 'America/Mexico_City')
    default: return ONE_ZONE[country] ?? null
  }
}
