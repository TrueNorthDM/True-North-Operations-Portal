'use server'

/**
 * Auth Server Actions.
 *
 * - sendMagicLink: validates email domain on the SERVER (not just client),
 *   then asks Supabase to send the magic link.
 * - signOut: clears the session cookies and redirects to /login.
 *
 * Layer 2 of 3 defense-in-depth (client → server → DB trigger).
 */

import { createClient } from '@/lib/supabase/server'
import { isAllowedEmail } from '@/lib/auth-constants'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

/**
 * Builds the absolute callback URL that Supabase embeds in the magic-link
 * email. It MUST point back to the host the user is actually on — otherwise
 * a request from production sends an email pointing to localhost (or vice
 * versa).
 *
 * Strategy: derive from incoming request headers (Option A). Works in every
 * environment without extra config — Vercel sets `host` and `x-forwarded-proto`
 * correctly on prod, previews, and custom domains; the Next.js dev server
 * sets them for localhost. No env vars to remember.
 *
 * Whatever this returns MUST also be present on Supabase's Auth → URL
 * Configuration allow-list — otherwise Supabase silently rewrites it to the
 * project's Site URL.
 */
async function getCallbackUrl(): Promise<string> {
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const host = h.get('host')
  return `${proto}://${host}/auth/callback`
}

export async function sendMagicLink(input: { email: string }): Promise<{ ok: boolean; error?: string }> {
  const email = input.email.trim().toLowerCase()

  if (!email) return { ok: false, error: 'Enter your email.' }

  // Layer 2 of defense-in-depth: server-side domain check.
  // (Layer 1 is in the client UI; Layer 3 is the DB trigger.)
  if (!isAllowedEmail(email)) {
    return {
      ok: false,
      error: 'Only @goodnewsadvocates.org emails can sign in to this app.',
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Where Supabase sends the user after they click the email link.
      // Must be on the Allow-List in Supabase Auth → URL Configuration —
      // any URL not on that list gets silently replaced by the Site URL.
      emailRedirectTo: await getCallbackUrl(),
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
