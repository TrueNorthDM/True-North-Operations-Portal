/**
 * language-colors.ts
 *
 * Single source of truth for per-language color tokens.
 *
 * Each language gets a unique soft-bg + saturated-text pair so EN, PT, ES, SW
 * (and future langs) are distinguishable at a glance, even on dense tables.
 * The "neutral" pair is used for the "not done yet" state in status tables.
 *
 * Colors chosen to NOT collide with:
 *   - AAAF brand (teal/green)
 *   - HFA brand (orange)
 *   - status colors (success green, error red, warning amber for system-level)
 *
 * Add a new language? Just add an entry below. Components fall back to a
 * neutral slate pair for unknown codes so nothing breaks.
 */

export interface LanguagePalette {
  bg: string
  text: string
  border: string
}

const LANGUAGE_COLORS: Record<string, LanguagePalette> = {
  en: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  pt: { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' },
  es: { bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
  sw: { bg: 'bg-lime-100', text: 'text-lime-700', border: 'border-lime-200' },
  fr: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
}

const NEUTRAL: LanguagePalette = {
  bg: 'bg-slate-100',
  text: 'text-slate-400',
  border: 'border-slate-200',
}

const UNKNOWN: LanguagePalette = {
  bg: 'bg-slate-200',
  text: 'text-slate-700',
  border: 'border-slate-300',
}

/** Always return the language's own color (used for config/identity contexts). */
export function languagePalette(lang: string): LanguagePalette {
  return LANGUAGE_COLORS[lang] ?? UNKNOWN
}

/**
 * Status-aware palette for tables:
 *   done=true  → the language's own color (it's "completed")
 *   done=false → neutral grey (it's "not done yet")
 */
export function languageStatusPalette(lang: string, done: boolean): LanguagePalette {
  if (!done) return NEUTRAL
  return languagePalette(lang)
}
