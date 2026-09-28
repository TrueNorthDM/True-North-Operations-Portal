/**
 * Who may use the portal: sign-in by invitation (migration 089, plan step p4-invite).
 *
 * A person may sign in, and keep using the portal, while all of this holds:
 *   - they are active in the Directory;
 *   - an admin has invited them (people.portal_invited_at);
 *   - they sign in with their GoodNews mailbox (people.email_goodnews).
 * The founding account, arnaldo.oliveira@me.com, is the one exception.
 *
 * The rule itself lives in the database (portal_can_sign_in), where the sign-up
 * trigger uses it too. This module asks it before a sign-in link is sent, and
 * mirrors it on every page for sessions that already exist, so that deactivating
 * someone or revoking their invitation closes their access on the next page load.
 */

import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser } from '@/lib/auth/session'
import { isAllowedEmail } from '@/lib/auth-constants'
import { isFounding, mayUsePortal, type PortalPerson } from '@/lib/auth/portal-rule'

/** Postgres "undefined column / function": migration 089 has not run yet. */
function isMissingMigration(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === '42703' || error.code === '42883' || error.code === 'PGRST202'
}

/**
 * May this address be sent a sign-in link? The shape first (cheap, no database),
 * then the invitation. Before migration 089 runs, the shape alone decides, as it
 * always did, so deploying the code first locks nobody out.
 */
export async function canSignIn(email: string): Promise<boolean> {
  if (!isAllowedEmail(email)) return false
  const db = createAdminClient()
  const { data, error } = await db.rpc('portal_can_sign_in', { p_email: email })
  if (error) {
    if (isMissingMigration(error)) return true
    console.error('[portal-access] portal_can_sign_in failed:', error.message)
    return false
  }
  return data === true
}

/**
 * May the signed-in session keep using the portal? Asked once per request by the
 * app layout. The real session, never a View Stage preview: a preview changes what
 * is rendered, not who is signed in.
 *
 * 'ok' when there is nothing to decide (no session: the proxy already sends those
 * to /login), and also when the database cannot answer: failing closed on a
 * passing error would sign everybody out at once.
 */
export const checkPortalAccess = cache(async function checkPortalAccess(): Promise<'ok' | 'denied'> {
  const user = await getSessionUser()
  if (!user || isFounding(user.email)) return 'ok'

  const db = createAdminClient()
  const cols = 'status, email_goodnews, portal_invited_at'
  let res = await db.from('people').select(cols).eq('profile_id', user.id).limit(1)
  if (!res.error && !res.data?.length && user.email) {
    // ilike for case, with LIKE's wildcards escaped: an underscore in an
    // address must not match any character.
    const exact = user.email.replace(/[\\%_]/g, c => `\\${c}`)
    res = await db.from('people').select(cols).ilike('email_goodnews', exact).limit(1)
  }
  if (res.error) {
    if (!isMissingMigration(res.error)) console.error('[portal-access] check failed:', res.error.message)
    return 'ok'
  }
  const person = (res.data?.[0] ?? null) as PortalPerson | null
  return mayUsePortal(user.email, person) ? 'ok' : 'denied'
})

/**
 * End every session of an account: on deactivation, removal or a revoked
 * invitation. Best effort; the page gate closes access either way.
 */
export async function endSessions(profileId: string | null | undefined): Promise<void> {
  if (!profileId) return
  const db = createAdminClient()
  const { error } = await db.rpc('portal_end_sessions', { p_user: profileId })
  if (error && !isMissingMigration(error)) {
    console.error('[portal-access] portal_end_sessions failed:', error.message)
  }
}
