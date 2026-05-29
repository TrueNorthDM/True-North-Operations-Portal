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
      emailRedirectTo: 'http://localhost:3000/auth/callback',
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
