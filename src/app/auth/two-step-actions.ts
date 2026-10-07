'use server'

/**
 * Two-step sign-in, the person's side (plan step p4-2fa). Supabase MFA with an
 * authenticator app (TOTP), through the signed-in person's own session, so a
 * verified code upgrades THAT session to aal2 (the cookies are rewritten here).
 *
 * - startEnroll: a fresh factor, with the QR code, the key and the otpauth link.
 * - verifyEnroll: the first code from the app turns the factor on.
 * - verifyTwoStep: the code at every sign-in after that.
 * - skipTwoStep: "Skip for now", while their week to set it up runs.
 * - moveTwoStep: from My profile, to set it up again on a new phone.
 *
 * The admin's side (Reset in the Directory) is resetTwoStep in admin/people/actions.
 */

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/auth/safe-next'
import { withStartPage } from '@/lib/auth/start-page'
import { SKIP_COOKIE, checkTwoStep } from '@/lib/auth/two-step'

// Short on purpose: it is written into the QR code twice (label and issuer), and a
// longer name makes a denser code that phone cameras struggle to read. It is also
// the name the authenticator app shows next to the code.
const ISSUER = 'True North Portal'

/** Where they were going, else the start page they chose in Settings (Home by default). */
async function landing(): Promise<string> {
  const store = await cookies()
  const next = safeNext(store.get('tn_next')?.value)
  store.delete('tn_next')
  if (next !== '/') return next
  const { data: { user } } = await (await createClient()).auth.getUser()
  return withStartPage(next, user)
}

export interface EnrollStart {
  factorId: string
  qr: string
  secret: string
  uri: string
}

/**
 * Start setting up the app. Any half-finished setup from before (a QR shown and
 * never confirmed) is cleared first, so the account never piles up factors.
 */
export async function startEnroll(): Promise<EnrollStart | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Your session has ended. Sign in again.' }

  const { data: list } = await supabase.auth.mfa.listFactors()
  for (const f of list?.all ?? []) {
    if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id })
  }
  if ((list?.totp ?? []).some(f => f.status === 'verified')) return { error: 'Two-step sign-in is already set up on this account.' }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    issuer: ISSUER,
    friendlyName: 'Authenticator app',
  })
  if (error || !data) return { error: error?.message ?? 'Could not start the setup. Try again.' }
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri }
}

const WRONG = 'That code is not right. Codes change every 30 seconds: type the one the app shows now.'

/** The first code from the app: it proves the app works and turns the factor on. */
export async function verifyEnroll(input: { factorId: string; code: string }): Promise<{ ok: false; error: string } | never> {
  const supabase = await createClient()
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: input.factorId, code: input.code.replace(/\D/g, '') })
  if (error) return { ok: false, error: WRONG }
  ;(await cookies()).delete(SKIP_COOKIE)
  redirect(await landing())
}

/** The code at sign-in, for someone whose app is set up. */
export async function verifyTwoStep(code: string): Promise<{ ok: false; error: string } | never> {
  const supabase = await createClient()
  const { data } = await supabase.auth.mfa.listFactors()
  const factor = (data?.totp ?? []).find(f => f.status === 'verified')
  if (!factor) redirect('/auth/two-step/setup')
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.replace(/\D/g, '') })
  if (error) return { ok: false, error: WRONG }
  redirect(await landing())
}

/** "Skip for now": only while their week runs; the reminder stays on every page. */
export async function skipTwoStep(): Promise<void> {
  const status = await checkTwoStep()
  if (status.need === 'enroll-required') redirect('/auth/two-step/setup')
  ;(await cookies()).set(SKIP_COOKIE, '1', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' })
  redirect(await landing())
}

/**
 * Move two-step sign-in to a new phone, from My profile. Only from a session that
 * has given the current app's code (aal2): the old app is removed, and the setup
 * screen comes up for the new one. Someone who has lost the old phone cannot get
 * this far, and asks an admin for a Reset instead.
 */
export async function moveTwoStep(): Promise<{ ok: false; error: string } | never> {
  const supabase = await createClient()
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.currentLevel !== 'aal2') return { ok: false, error: 'Sign in with your current app first.' }
  const { data } = await supabase.auth.mfa.listFactors()
  for (const f of data?.all ?? []) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id })
    if (error) return { ok: false, error: error.message }
  }
  redirect('/auth/two-step/setup')
}
