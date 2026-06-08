/**
 * auth-constants.ts
 *
 * Single source of truth for who can sign in: an allowed email domain plus a
 * small list of named-address exceptions.
 *
 * Used by:
 *   - Client validation in /login (instant feedback)
 *   - Server-side validation in the magic-link Server Action
 *   - The Postgres trigger on auth.users mirrors these same values
 *
 * If you change either list, also update the Postgres function
 * `enforce_email_domain` (supabase/migrations/010).
 */

export const ALLOWED_EMAIL_DOMAINS = ['goodnewsadvocates.org'] as const

// Named exceptions: specific addresses allowed regardless of domain.
// arnaldo.oliveira@me.com is the primary admin — auto-promoted to 'admin' by the
// handle_new_user DB trigger (migration 007). Everyone else must use a
// goodnewsadvocates.org address.
export const ALLOWED_EMAILS = ['arnaldo.oliveira@me.com'] as const

export function isAllowedEmail(email: string): boolean {
  const e = email.trim().toLowerCase()
  if (ALLOWED_EMAILS.some(a => a === e)) return true
  return ALLOWED_EMAIL_DOMAINS.some(d => e.endsWith('@' + d))
}
