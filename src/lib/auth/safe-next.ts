/**
 * safeNext — sanitize a post-login redirect target ("next").
 *
 * Only same-origin relative paths are allowed. Rejects:
 *   - absolute URLs ("https://evil.com")
 *   - protocol-relative URLs ("//evil.com") — these start with "/" but the
 *     browser resolves them to another origin
 *   - the backslash variant ("/\evil.com") — WHATWG treats "\" like "/"
 * Anything suspicious falls back to "/". Used by the auth callback (where a
 * crafted `next` could otherwise open-redirect) and by sendMagicLink.
 */
export function safeNext(raw: string | null | undefined): string {
  const fallback = '/'
  if (!raw || !raw.startsWith('/')) return fallback
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  return raw
}
