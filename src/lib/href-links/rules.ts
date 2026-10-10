/**
 * The Href Links rules, in one place (audit, 10 October 2026, decided by
 * Arnaldo the same day). Pure: no database, no React.
 *
 *   done     a page is done when every CURRENT site language is confirmed live,
 *            or it is marked Not relevant. confirmed_done_at is only the date it
 *            first got there (history, and "Last 2 weeks"). A language added
 *            later makes the page not done again, everywhere alike.
 *   urls     a page's URL is https and on its own site's domain; the bare
 *            domain is written with "www". Anything else is refused, whether
 *            typed in the portal or read from Monday.
 */

export type SiteCode = 'aaaf' | 'hfa'

/** The languages a site has when its row has none configured yet. */
export const DEFAULT_LANGUAGES: Record<SiteCode, string[]> = {
  aaaf: ['en', 'pt', 'es', 'sw'],
  hfa: ['en', 'sw'],
}

export function isSiteCode(v: unknown): v is SiteCode {
  return v === 'aaaf' || v === 'hfa'
}

export function isPageDone(
  page: { notRelevant: boolean; confirmed: ReadonlySet<string> },
  siteLanguages: readonly string[],
): boolean {
  if (page.notRelevant) return true
  return siteLanguages.length > 0 && siteLanguages.every(l => page.confirmed.has(l))
}

/** "https://www.askanadventistfriend.com" -> "www.askanadventistfriend.com". */
export function siteHost(domain: string | null | undefined): string | null {
  if (!domain) return null
  try {
    return new URL(domain.includes('://') ? domain : `https://${domain}`).hostname.toLowerCase()
  } catch {
    return null
  }
}

export type UrlCheck = { ok: true; url: string } | { ok: false; reason: string }

/**
 * A page URL as the site's hreflang needs it, or why not.
 * The bare domain (askanadventistfriend.com) becomes the www form.
 */
export function checkPageUrl(raw: string, domain: string | null | undefined): UrlCheck {
  const host = siteHost(domain)
  if (!host) return { ok: false, reason: 'The site has no domain set in Settings.' }
  const v = String(raw ?? '').trim()
  if (/\s/.test(v)) return { ok: false, reason: 'A link cannot contain spaces.' }
  let u: URL
  try {
    u = new URL(v)
  } catch {
    return { ok: false, reason: 'This is not a link.' }
  }
  if (u.protocol !== 'https:') return { ok: false, reason: 'The link must start with https://.' }
  if (u.username || u.password) return { ok: false, reason: 'The link cannot carry a user name or password.' }
  const bare = host.replace(/^www\./, '')
  const given = u.hostname.toLowerCase()
  if (given !== host && given !== bare) return { ok: false, reason: `The link is not a page on ${host}.` }
  u.hostname = host
  u.port = ''
  return { ok: true, url: u.toString() }
}
