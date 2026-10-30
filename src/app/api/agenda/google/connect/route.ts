/**
 * GET /api/agenda/google/connect?for=me|team
 *
 * "+ Connect a Google account" and "+ Connect the team calendar" in Agenda
 * settings come here: the portal remembers who asked in a short cookie and
 * sends them to Google's sign-in. Google answers at ./callback.
 */

import { randomBytes } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { writerAccess } from '@/lib/access/resolve'
import { agendaGoogleOpen } from '@/lib/agenda/google-lock'
import { loadGoogleApp } from '@/lib/agenda/google-app'
import { APPROVED_DOMAIN } from '@/lib/agenda/accounts'
import { authUrl, CALLBACK_PATH, STATE_COOKIE, stateCookie } from '@/lib/agenda/google-oauth'
import { publicOrigin } from '@/lib/auth/public-origin'

export async function GET(request: NextRequest) {
  const base = publicOrigin(request.url)
  const back = (code: string) => NextResponse.redirect(new URL(`/agenda/settings?google=${code}`, base))
  if (!(await agendaGoogleOpen())) return NextResponse.redirect(new URL('/agenda', base))
  // Not in a View Stage preview, and only for the person really signed in.
  const access = await writerAccess()
  if (!access?.personId || !access.can('agenda')) return back('signin')
  const purpose = new URL(request.url).searchParams.get('for') === 'team' ? 'team' : 'me'
  if (purpose === 'team' && access.level !== 'super_admin') return back('not_allowed')
  const app = await loadGoogleApp()
  if (!app) return back('no_app')

  const state = randomBytes(24).toString('base64url')
  const res = NextResponse.redirect(authUrl(app, `${base}${CALLBACK_PATH}`, state, purpose === 'team' ? `office@${APPROVED_DOMAIN}` : undefined))
  res.cookies.set(STATE_COOKIE, stateCookie(state, purpose, access.personId), {
    httpOnly: true, secure: base.startsWith('https:'), sameSite: 'lax', path: '/api/agenda/google', maxAge: 600,
  })
  return res
}
