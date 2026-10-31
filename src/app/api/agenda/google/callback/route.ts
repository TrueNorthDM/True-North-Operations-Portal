/**
 * GET /api/agenda/google/callback
 *
 * Google sends the person back here after they sign in. The portal checks the
 * answer belongs to the sign-in it started (the cookie from ./connect, for the
 * same person), swaps the code for tokens, checks the account and keeps it.
 * Every outcome lands on Agenda settings with a short code the page words.
 */

import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { writerAccess } from '@/lib/access/resolve'
import { agendaGoogleOpen } from '@/lib/agenda/google-lock'
import { loadGoogleApp, saveConnection } from '@/lib/agenda/google-app'
import { CALLBACK_PATH, exchangeCode, idTokenClaims, missingScopes, onApprovedDomain, readStateCookie, STATE_COOKIE } from '@/lib/agenda/google-oauth'
import { publicOrigin } from '@/lib/auth/public-origin'

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

export async function GET(request: NextRequest) {
  const base = publicOrigin(request.url)
  const url = new URL(request.url)
  const saved = readStateCookie(request.cookies.get(STATE_COOKIE)?.value)
  const back = (code: string, email?: string) => {
    const res = NextResponse.redirect(new URL(`/agenda/settings?google=${code}${email ? `&email=${encodeURIComponent(email)}` : ''}`, base))
    res.cookies.set(STATE_COOKIE, '', { path: '/api/agenda/google', maxAge: 0 })
    return res
  }

  if (!(await agendaGoogleOpen())) return NextResponse.redirect(new URL('/agenda', base))
  const state = url.searchParams.get('state') ?? ''
  if (!saved || !same(saved.state, state)) return back('expired')
  const access = await writerAccess()
  if (!access?.personId || access.personId !== saved.personId || !access.can('agenda')) return back('signin')
  if (saved.purpose === 'team' && access.level !== 'super_admin') return back('not_allowed')
  // "Cancel" on Google's page, or the person closed the consent.
  if (url.searchParams.get('error')) return back('cancelled')
  const code = url.searchParams.get('code')
  if (!code) return back('expired')

  const app = await loadGoogleApp()
  if (!app) return back('no_app')
  try {
    const answer = await exchangeCode(app, code, `${base}${CALLBACK_PATH}`)
    const who = answer.id_token ? idTokenClaims(answer.id_token) : null
    if (!who || !who.verified) return back('failed')
    // Own accounts may be on any Google domain (the app is External since 30 Oct); the team calendar stays a True North address.
    if (saved.purpose === 'team' && !onApprovedDomain(who.email)) return back('domain', who.email)
    if (missingScopes(answer.scope ?? '').length) return back('scopes', who.email)
    const r = await saveConnection({ purpose: saved.purpose, personId: access.personId, email: who.email, sub: who.sub, answer })
    if (!r.ok) return back(r.reason, who.email)
    revalidatePath('/agenda/settings'); revalidatePath('/agenda')
    return back(saved.purpose === 'team' ? 'team_connected' : 'connected', who.email)
  } catch (e) {
    console.error('[agenda google] callback:', e instanceof Error ? e.message : e)
    return back('failed')
  }
}
