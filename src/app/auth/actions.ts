'use server'

/**
 * Auth Server Actions.
 *
 * - sendMagicLink: checks on the SERVER (not just client) that the address is
 *   invited (migration 089), then asks Supabase to send the magic link.
 * - signOut: clears the session cookies and redirects to /login.
 *
 * Layer 2 of 3 defense-in-depth (client → server → DB trigger).
 */

import { createClient } from '@/lib/supabase/server'
import { isAllowedEmail, NOT_INVITED_MESSAGE, SHAPE_MESSAGE } from '@/lib/auth-constants'
import { canSignIn } from '@/lib/auth/portal-access'
import { safeNext } from '@/lib/auth/safe-next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

/**
 * Builds the absolute callback URL that Supabase embeds in the magic-link
 * email. It MUST point back to the host the user is actually on, otherwise
 * a request from production sends an email pointing to localhost (or vice
 * versa).
 *
 * Strategy: derive from incoming request headers (Option A). Works in every
 * environment without extra config, Vercel sets `host` and `x-forwarded-proto`
 * correctly on prod, previews, and custom domains; the Next.js dev server
 * sets them for localhost. No env vars to remember.
 *
 * Whatever this returns MUST also be present on Supabase's Auth → URL
 * Configuration allow-list, otherwise Supabase silently rewrites it to the
 * project's Site URL.
 */
async function getCallbackUrl(): Promise<string> {
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const host = h.get('host')
  return `${proto}://${host}/auth/callback`
}

export async function sendMagicLink(input: { email: string; next?: string }): Promise<{ ok: boolean; error?: string }> {
  const email = input.email.trim().toLowerCase()

  if (!email) return { ok: false, error: 'Enter your email.' }

  // Layer 2 of defense-in-depth: the address must be a GoodNews mailbox of an
  // active, invited person (or the founding account). Layer 1 is the shape check
  // in the client UI; layer 3 is the DB trigger on auth.users (migration 089).
  if (!isAllowedEmail(email)) return { ok: false, error: SHAPE_MESSAGE }
  if (!(await canSignIn(email))) return { ok: false, error: NOT_INVITED_MESSAGE }

  // Carry the intended destination through the magic link so the user lands
  // back where they started. Validated here too (defense-in-depth) since it
  // round-trips through the email; the callback re-sanitizes on the way in.
  const callback = await getCallbackUrl()
  const next = safeNext(input.next)
  const emailRedirectTo = next === '/' ? callback : `${callback}?next=${encodeURIComponent(next)}`

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Where Supabase sends the user after they click the email link.
      // Must be on the Allow-List in Supabase Auth → URL Configuration,
      // any URL not on that list gets silently replaced by the Site URL.
      // (Extra query params like ?next= are preserved as long as the callback
      // PATH is allow-listed, which it already is for the base flow.)
      emailRedirectTo,
      shouldCreateUser: true,
    },
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
