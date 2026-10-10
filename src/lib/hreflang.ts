/**
 * hreflang.ts
 *
 * Generates <link rel="alternate" hreflang="..."> tags for a page.
 *
 * These tags tell Google which version of a page to show for each
 * language/region. Without them, Google may serve the wrong language
 * to users, which is exactly the problem this app solves.
 *
 * Spec: https://developers.google.com/search/docs/specialty/international/locales-languages
 */

/**
 * Override map: our internal language code → desired BCP-47 hreflang value.
 *
 * Only add entries when the hreflang value should differ from the internal
 * code (e.g. 'pt-br' → 'pt', or a custom legacy code). For codes that already
 * match BCP-47 (en, pt, es, sw, fr, de, …), DON'T add them here, the resolver
 * uses the raw code as fallback, so they work automatically.
 *
 * Was previously a hard whitelist that silently dropped any unknown code.
 * Now it's an opt-in override and the fallback prevents missing tags.
 */
const HREFLANG_OVERRIDES: Record<string, string> = {
  // (empty by default, add overrides only when needed)
}

/**
 * Resolve a language code to its BCP-47 hreflang value.
 * Override → raw code → null (if invalid).
 */
function resolveHreflang(languageCode: string): string | null {
  if (HREFLANG_OVERRIDES[languageCode]) return HREFLANG_OVERRIDES[languageCode]
  // Basic shape check, letters + optional region (e.g. 'en', 'pt-BR')
  if (/^[a-z]{2,3}(-[A-Z]{2})?$/i.test(languageCode)) return languageCode.toLowerCase()
  return null
}

export interface PageUrl {
  language_code: string
  url: string
}

export interface HreflangTag {
  hreflang: string
  href: string
}

/**
 * Generates an array of hreflang tag objects for a page.
 *
 * @param urls        Array of { language_code, url } for this page
 * @param defaultLang The language to use as x-default (usually 'en')
 * @returns           Array of { hreflang, href } objects
 */
export function generateHreflangTags(
  urls: PageUrl[],
  defaultLang = 'en',
): HreflangTag[] {
  const tags: HreflangTag[] = []

  // Add x-default pointing to the default language URL
  const defaultUrl = urls.find(u => u.language_code === defaultLang)
  if (defaultUrl) {
    tags.push({ hreflang: 'x-default', href: defaultUrl.url })
  }

  // Add one tag per language, sorted to match the order in the Sheet
  const sorted = [...urls].sort((a, b) =>
    a.language_code.localeCompare(b.language_code),
  )

  for (const { language_code, url } of sorted) {
    const hreflangCode = resolveHreflang(language_code)
    if (hreflangCode) {
      tags.push({ hreflang: hreflangCode, href: url })
    }
  }

  return tags
}

/**
 * Renders hreflang tags as an HTML string ready to paste into WordPress.
 *
 * Example output:
 *   <link rel="alternate" href="https://example.com/" hreflang="x-default" />
 *   <link rel="alternate" href="https://example.com/" hreflang="en" />
 *   <link rel="alternate" href="https://example.com/pt/page/" hreflang="pt" />
 */
export function renderHreflangHtml(urls: PageUrl[], defaultLang = 'en'): string {
  const tags = generateHreflangTags(urls, defaultLang)
  return tags
    .map(
      ({ hreflang, href }) =>
        `<link rel="alternate" href="${escapeAttr(href)}" hreflang="${escapeAttr(hreflang)}" />`,
    )
    .join('\n')
}

/**
 * Escaped for an HTML attribute (audit, 10 October 2026). This text is pasted
 * into the head of the public sites: a link with a quote in it closed the
 * attribute and could carry a script there.
 */
export function escapeAttr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

