/**
 * GET /api/agenda/zoom/connect?from=settings|agenda
 *
 * "Connect Zoom" in Agenda settings and in the New event drawer come here:
 * the portal remembers who asked in a short cookie and sends them to Zoom's
 * sign-in. Zoom answers at ./callback.
 */

import { randomBytes } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { writerAccess } from '@/lib/access/resolve'
import { agendaGoogleOpen } from '@/lib/agenda/google-lock'
import { loadZoomApp } from '@/lib/agenda/zoom-app'
import { ZOOM_CALLBACK_PATH, ZOOM_STATE_COOKIE, zoomAuthUrl, zoomStateCookie } from '@/lib/agenda/zoom-oauth'
import { publicOrigin } from '@/lib/auth/public-origin'

export async function GET(request: NextRequest) {
  const base = publicOrigin(request.url)
  const back = (code: string) => NextResponse.redirect(new URL(`/agenda/settings?zoom=${code}`, base))
  if (!(await agendaGoogleOpen())) return NextResponse.redirect(new URL('/agenda', base))
  // Not in a View Stage preview, and only for the person really signed in.
  const access = await writerAccess()
  if (!access?.personId || !access.can('agenda')) return back('signin')
  const app = await loadZoomApp()
  if (!app) return back('no_app')

  const from = new URL(request.url).searchParams.get('from') === 'agenda' ? 'agenda' : 'settings'
  const state = randomBytes(24).toString('base64url')
  const res = NextResponse.redirect(zoomAuthUrl(app, `${base}${ZOOM_CALLBACK_PATH}`, state))
  res.cookies.set(ZOOM_STATE_COOKIE, zoomStateCookie(state, access.personId, from), {
    httpOnly: true, secure: base.startsWith('https:'), sameSite: 'lax', path: '/api/agenda/zoom', maxAge: 600,
  })
  return res
}
