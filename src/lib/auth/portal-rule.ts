/**
 * The invitation rule's pure half (migration 089): no database, no server code,
 * so the Directory's client components and the tests can use it. The server half
 * that asks the database is lib/auth/portal-access.ts.
 */

import { ALLOWED_EMAILS } from '@/lib/auth-constants'

/** The Directory fields the rule reads. */
export interface PortalPerson {
  status: string | null
  email_goodnews: string | null
  portal_invited_at: string | null
}

/** The founding account, which may always sign in (still with two steps). */
export const isFounding = (email: string | null | undefined) =>
  !!email && ALLOWED_EMAILS.some(a => a === email.trim().toLowerCase())

/**
 * The rule for a session that already exists, given the signed-in address and the
 * person behind it. Pure, so it is tested without a database.
 *
 * It does not insist that the session's address is the GoodNews one: an account
 * opened before migration 089 may still carry another address until it is moved,
 * and what matters for a live session is that the PERSON is active and invited.
 */
export function mayUsePortal(email: string | null | undefined, person: PortalPerson | null): boolean {
  if (isFounding(email)) return true
  if (!person) return false
  if ((person.status ?? 'active') === 'inactive') return false
  return !!person.portal_invited_at
}

/** Where a person stands with the portal, for the Directory. */
export type PortalAccessState = 'no-address' | 'not-invited' | 'invited' | 'signed-in' | 'inactive'

export function portalAccessState(p: PortalPerson & { hasAccount: boolean }): PortalAccessState {
  if ((p.status ?? 'active') === 'inactive') return 'inactive'
  // Invited and already signed in: has access, whichever address it was with
  // (the founding account signs in with its me.com address, not a GoodNews one).
  if (p.portal_invited_at && p.hasAccount) return 'signed-in'
  if (!p.email_goodnews) return 'no-address'
  if (!p.portal_invited_at) return 'not-invited'
  return p.hasAccount ? 'signed-in' : 'invited'
}

