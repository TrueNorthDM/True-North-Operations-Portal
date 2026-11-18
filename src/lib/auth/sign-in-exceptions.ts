/**
 * Sign-in exceptions (owner, 18 November 2026; migration 168): the people who
 * sign in with an address that is not their GoodNews mailbox, because a Super
 * Admin listed it for them in Directory > Portal access. The rule that reads
 * the list is the database's (portal_can_sign_in); this is the list itself.
 * Server only: the table is closed to sessions.
 */

import { createAdminClient } from '@/lib/supabase/admin'

/** Postgres "undefined table": migration 168 has not run yet, so there is no exception. */
const missing = (e: { code?: string } | null) => !!e && (e.code === '42P01' || e.code === 'PGRST205')

/** person id -> their exception address. */
export async function loadSignInExceptions(): Promise<Map<string, string>> {
  const { data, error } = await createAdminClient().from('portal_sign_in_exceptions').select('person_id, email')
  if (error) {
    if (!missing(error)) console.error('[sign-in exceptions] read:', error.message)
    return new Map()
  }
  return new Map((data ?? []).map(r => [r.person_id, r.email]))
}

/** One person's exception address, or null. */
export async function signInExceptionOf(personId: string): Promise<string | null> {
  const { data, error } = await createAdminClient().from('portal_sign_in_exceptions').select('email').eq('person_id', personId).maybeSingle()
  if (error) {
    if (!missing(error)) console.error('[sign-in exceptions] read one:', error.message)
    return null
  }
  return data?.email ?? null
}

/** The person an address is the exception of, or null. */
export async function personOfException(email: string): Promise<string | null> {
  const { data, error } = await createAdminClient().from('portal_sign_in_exceptions').select('person_id').eq('email', email.trim().toLowerCase()).maybeSingle()
  if (error) {
    if (!missing(error)) console.error('[sign-in exceptions] by address:', error.message)
    return null
  }
  return data?.person_id ?? null
}

/** An address has the shape of one: "name@host.tld", no spaces. */
export const looksLikeEmail = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
