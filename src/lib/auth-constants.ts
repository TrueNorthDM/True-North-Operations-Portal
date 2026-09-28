/**
 * auth-constants.ts
 *
 * The SHAPE of an address that can sign in: a GoodNews mailbox, plus the one
 * named exception. Since migration 089 the shape is necessary but not enough:
 * the address must also be the GoodNews mailbox of a person who is active in the
 * Directory and has been invited. That second half needs the database, so it
 * lives in portal_can_sign_in (migration 089) and lib/auth/portal-access.ts.
 *
 * Used by:
 *   - Client validation in /login (instant feedback on the shape)
 *   - Server-side validation in the magic-link Server Action, before the invite check
 *
 * If you change either list, also update portal_can_sign_in (migration 089).
 */

// One address per person: their GoodNews mailbox (people.email_goodnews), so the
// same person never ends up with two accounts.
export const ALLOWED_EMAIL_DOMAINS = ['goodnewsadvocates.org'] as const

// Named exceptions: specific addresses allowed regardless of domain.
// arnaldo.oliveira@me.com is the founding admin account, auto-promoted to 'admin'
// by the handle_new_user DB trigger. It still goes through two-step sign-in.
export const ALLOWED_EMAILS = ['arnaldo.oliveira@me.com'] as const

export function isAllowedEmail(email: string): boolean {
  const e = email.trim().toLowerCase()
  if (ALLOWED_EMAILS.some(a => a === e)) return true
  return ALLOWED_EMAIL_DOMAINS.some(d => e.endsWith('@' + d))
}

/** What the sign-in page says when the shape is wrong. */
export const SHAPE_MESSAGE = 'Sign in with your @goodnewsadvocates.org address.'

/** What it says when the shape is right but the address is not invited (or no longer active). */
export const NOT_INVITED_MESSAGE =
  "This address hasn't been invited to the portal. Ask an admin to invite you."
