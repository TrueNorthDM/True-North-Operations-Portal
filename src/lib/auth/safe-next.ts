/**
 * safeNext: sanitize a post-login redirect target ("next").
 *
 * Only same-origin relative paths are allowed. Rejects:
 *   - absolute URLs ("https://evil.com")
 *   - protocol-relative URLs ("//evil.com"), these start with "/" but the
 *     browser resolves them to another origin
 *   - the backslash variant ("/\evil.com"), WHATWG treats "\" like "/"
 *   - control characters ("/\t/evil.com"): URL parsing strips tabs and
 *     newlines, so that one becomes "//evil.com" (audit, 8 October 2026)
 * And, whatever the spelling, the target must resolve to this origin: the
 * same parser the browser uses has the last word, so a trick not listed above
 * is still refused. Anything suspicious falls back to "/". Used by the auth
 * callback (where a crafted `next` could otherwise open-redirect) and by
 * sendMagicLink.
 */
export function safeNext(raw: string | null | undefined): string {
  const fallback = '/'
  if (!raw || !raw.startsWith('/')) return fallback
  if (raw.startsWith('//') || raw.includes('\\')) return fallback
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback
  const base = 'https://portal.invalid'
  try {
    if (new URL(raw, base).origin !== base) return fallback
  } catch {
    return fallback
  }
  return raw
}
