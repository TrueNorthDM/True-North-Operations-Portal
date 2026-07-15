// Display helpers for language codes in the Sites & languages UI: full names,
// flag-ish dot colours (matching the Publishing targets palette), and a lenient
// name/code parser for the "add language" field.

const NAME_OVERRIDES: Record<string, string> = {
  en: 'English',
  pt: 'Portuguese',
  es: 'Spanish',
  sw: 'Swahili',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  'pt-br': 'Portuguese (Brazil)',
}

let displayNames: Intl.DisplayNames | null | undefined
function intl(): Intl.DisplayNames | null {
  if (displayNames !== undefined) return displayNames
  try {
    displayNames = new Intl.DisplayNames(['en'], { type: 'language' })
  } catch {
    displayNames = null
  }
  return displayNames
}

/** "pt" → "Portuguese". Falls back to the uppercased code for unknown codes. */
export function languageName(code: string): string {
  const c = code.trim().toLowerCase()
  if (NAME_OVERRIDES[c]) return NAME_OVERRIDES[c]
  const base = c.split('-')[0]
  const n = intl()?.of(base)
  return n && n.toLowerCase() !== base ? n.charAt(0).toUpperCase() + n.slice(1) : code.toUpperCase()
}

// Dot colours by language, matching the Publishing targets flag palette.
const DOT: Record<string, string> = {
  en: '#111111',
  es: '#F5B800',
  pt: '#009C3B',
  sw: '#00A3DD',
  fr: '#0055A4',
  de: '#DD0000',
  it: '#008C45',
}
export function languageDot(code: string): string {
  const c = code.trim().toLowerCase()
  return DOT[c] ?? DOT[c.split('-')[0]] ?? '#8593a4'
}

// Accept a full name ("French") or a BCP-47 code ("fr", "pt-br") → normalized code.
const NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(NAME_OVERRIDES).map(([code, name]) => [name.toLowerCase(), code]),
)
export function codeFromInput(input: string): string | null {
  const v = input.trim().toLowerCase()
  if (!v) return null
  if (NAME_TO_CODE[v]) return NAME_TO_CODE[v]
  if (/^[a-z]{2,3}(-[a-z]{2})?$/i.test(v)) return v
  return null
}
