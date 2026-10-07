/**
 * Who is signed in, read once per request.
 *
 * Every page used to ask Supabase this three to five times before it rendered a
 * pixel: the proxy, the layout, getCurrentTier and loadAccess each called
 * `auth.getUser()`, which is a network round trip to the Auth server, and each
 * loaded the signed-in person from the directory again. The answers were identical
 * every time. This is the one place the question is asked while rendering.
 *
 * `getClaims()` rather than `getUser()`. The project signs its tokens with an
 * asymmetric key (ES256, checked against the public JWKS in September 2026), so
 * the claims are verified locally against the public key, cached for ten minutes,
 * instead of by asking the Auth server. An expired token is still refreshed first:
 * `getClaims()` goes through `getSession()`, which renews it.
 *
 * The trade-off, accepted deliberately: a verified, unexpired token is trusted
 * without asking whether the session was revoked since it was issued. A token
 * lives an hour, so a signed-out or removed user can keep reading pages for at most
 * that long. What they can see is still decided live, because roles and grants are
 * read from the database on every request.
 *
 * Reading only. Anything that WRITES verifies with `auth.getUser()` itself, which
 * asks the Auth server every time: the server actions do, and so does
 * `isSecurityAdmin()` through `getCurrentProfile()`. Do not use this to authorise a
 * write.
 */

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { loadCurrentPerson, type CurrentPerson } from '@/lib/directory/current-person'

/** The identity a render needs. Every caller used the id or the email, never more. */
export interface SessionUser {
  id: string
  email: string | null
  /** 'aal2' once the second step was given this session (two-step sign-in, p4-2fa). */
  aal: string | null
}

/** The signed-in user for this request, or null. Asked once, however many callers ask. */
export const getSessionUser = cache(async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub) return null
  return { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : null, aal: typeof claims.aal === 'string' ? claims.aal : null }
})

/**
 * The directory person for this request, View Stage included.
 *
 * loadCurrentPerson answers with the previewed person while View Stage is on,
 * which is what a render wants. It was called by the layout, by getCurrentTier and
 * by loadAccess on every page, one to two queries each time.
 */
export const getCurrentPerson = cache(async function getCurrentPerson(): Promise<CurrentPerson | null> {
  const [supabase, user] = await Promise.all([createClient(), getSessionUser()])
  return loadCurrentPerson(supabase, user)
})

/**
 * The directory person actually signed in, never a View Stage preview's: whose
 * access a WRITE is decided by (access/resolve.ts, loadRealAccess).
 */
export const getRealPerson = cache(async function getRealPerson(): Promise<CurrentPerson | null> {
  const [supabase, user] = await Promise.all([createClient(), getSessionUser()])
  return loadCurrentPerson(supabase, user, { real: true })
})
