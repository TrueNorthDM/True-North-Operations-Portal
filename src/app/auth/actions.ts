'use server'

/**
 * Auth Server Actions (plan step p4-code).
 *
 * - sendMagicLink: checks on the SERVER (not just client) that the address is
 *   invited (migration 089), then asks Supabase to email a 6-digit code and a
 *   one-click link. The email template is public/email-templates/magic-link.html.
 * - verifyCode: signs in with the 6-digit code, typed on any device.
 * - confirmLink: signs in with the one-click link from the email (the page at
 *   /auth/confirm calls it when the person presses the button).
 * - signOut: clears the session cookies and redirects to /login.
 *
 * Both ways in are verified on the server, with nothing kept in the browser that
 * asked for the email, so a link opened on the phone works as well as the code.
 *
 * Layer 2 of 3 defense-in-depth (client → server → DB trigger).
 */

import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isAllowedEmail, NOT_INVITED_MESSAGE, SHAPE_MESSAGE } from '@/lib/auth-constants'
import { canSignIn } from '@/lib/auth/portal-access'
import { safeNext } from '@/lib/auth/safe-next'
import { withStartPage } from '@/lib/auth/start-page'
import type { SignedInIdentity } from '@/lib/directory/current-person'
import { requestOrigin } from '@/lib/auth/origin'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

/**
 * Where the person was going when the sign-in started, kept for an hour. The code
 * is always typed in the browser that asked, so it has it; the link usually opens
 * there too. On another device the cookie is absent and they land on Home.
 */
const NEXT_COOKIE = 'tn_next'

export async function sendMagicLink(input: { email: string; next?: string }): Promise<{ ok: boolean; error?: string }> {
  const email = input.email.trim().toLowerCase()

  if (!email) return { ok: false, error: 'Enter your email.' }

  // Layer 2 of defense-in-depth: the address must be a GoodNews mailbox of an
  // active, invited person (or the founding account). Layer 1 is the shape check
  // in the client UI; layer 3 is the DB trigger on auth.users (migration 089).
  if (!isAllowedEmail(email)) return { ok: false, error: SHAPE_MESSAGE }
  if (!(await canSignIn(email))) return { ok: false, error: NOT_INVITED_MESSAGE }

  const next = safeNext(input.next)
  const store = await cookies()
  store.set(NEXT_COOKIE, next, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 })

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // The email's button is built from the template (SiteURL + token_hash, to
      // /auth/confirm), so this only matters to a template that still uses
      // ConfirmationURL: that one goes through /auth/callback, which exchanges the
      // code in the browser that asked. It must be on the allow-list in Supabase
      // Auth → URL Configuration, which it already is.
      emailRedirectTo: `${await requestOrigin()}/auth/callback`,
      shouldCreateUser: true,
    },
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Where they were going, else the start page they chose in Settings (Home by default). */
async function landing(user: SignedInIdentity | null | undefined): Promise<string> {
  const store = await cookies()
  const next = safeNext(store.get(NEXT_COOKIE)?.value)
  store.delete(NEXT_COOKIE)
  return withStartPage(next, user)
}

/** Sign in with the code from the email. */
export async function verifyCode(input: { email: string; code: string }): Promise<{ ok: false; error: string } | never> {
  const email = input.email.trim().toLowerCase()
  const token = input.code.replace(/\D/g, '')
  if (token.length < 6) return { ok: false, error: 'Enter the 6‑digit code from the email.' }
  // The invitation check again: the code was sent while they were invited, and
  // this closes the window if an admin revoked them in between.
  if (!(await canSignIn(email))) return { ok: false, error: NOT_INVITED_MESSAGE }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  if (error) return { ok: false, error: 'That code is not right, or it has expired. Check the latest email, or send a new one.' }
  redirect(await landing(data.user))
}

/** Sign in with the one-click link from the email (see /auth/confirm). */
export async function confirmLink(input: { tokenHash: string; type: string }): Promise<{ ok: false; error: string } | never> {
  const allowed: EmailOtpType[] = ['email', 'magiclink', 'signup', 'invite']
  const type = allowed.find(t => t === input.type)
  if (!input.tokenHash || !type) return { ok: false, error: 'This sign-in link is incomplete. Ask for a new one.' }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: input.tokenHash, type })
  if (error) return { ok: false, error: 'This sign-in link has expired or was already used. Ask for a new one.' }
  redirect(await landing(data.user))
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

/**
 * Settings, "Sign out on all devices": ends every session of this account, this
 * one included. Other devices find out when their access token next renews
 * (within the hour), since pages trust a valid token without asking the
 * sign-in service each time (lib/auth/session.ts).
 */
export async function signOutEverywhere() {
  const supabase = await createClient()
  await supabase.auth.signOut({ scope: 'global' })
  redirect('/login')
}
