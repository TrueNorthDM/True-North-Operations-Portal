/**
 * auth-constants.ts
 *
 * Single source of truth for the email domain whitelist.
 *
 * Used by:
 *   - Client validation in /login (instant feedback)
 *   - Server-side validation in the magic-link Server Action
 *   - The Postgres trigger on auth.users mirrors this same value
 *
 * If you change this list, also update the Postgres function `enforce_email_domain`.
 */

export const ALLOWED_EMAIL_DOMAINS = ['goodnewsadvocates.org'] as const

export function isAllowedEmail(email: string): boolean {
  const e = email.trim().toLowerCase()
  return ALLOWED_EMAIL_DOMAINS.some(d => e.endsWith('@' + d))
}
