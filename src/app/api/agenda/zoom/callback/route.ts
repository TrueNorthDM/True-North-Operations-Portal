/**
 * GET /api/agenda/zoom/callback
 *
 * Zoom sends the person back here after they allow the portal. The portal
 * checks the answer belongs to the sign-in it started (the cookie from
 * ./connect, for the same person), swaps the code for tokens, reads who they
 * are on Zoom and keeps the account. They land where they started: Agenda
 * settings, or the Agenda with the New event drawer open on Zoom.
 */

import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { writerAccess } from '@/lib/access/resolve'
import { agendaGoogleOpen } from '@/lib/agenda/google-lock'
import { loadZoomApp, saveZoomConnection } from '@/lib/agenda/zoom-app'
import { exchangeZoomCode, readZoomStateCookie, ZOOM_CALLBACK_PATH, ZOOM_STATE_COOKIE, zoomMe } from '@/lib/agenda/zoom-oauth'
import { publicOrigin } from '@/lib/auth/public-origin'

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

export async function GET(request: NextRequest) {
  const base = publicOrigin(request.url)
  const url = new URL(request.url)
  const saved = readZoomStateCookie(request.cookies.get(ZOOM_STATE_COOKIE)?.value)
  const back = (code: string, email?: string) => {
    const to = code === 'connected' && saved?.from === 'agenda' ? '/agenda?new=zoom' : `/agenda/settings?zoom=${code}${email ? `&email=${encodeURIComponent(email)}` : ''}`
    const res = NextResponse.redirect(new URL(to, base))
    res.cookies.set(ZOOM_STATE_COOKIE, '', { path: '/api/agenda/zoom', maxAge: 0 })
    return res
  }

  if (!(await agendaGoogleOpen())) return NextResponse.redirect(new URL('/agenda', base))
  const state = url.searchParams.get('state') ?? ''
  if (!saved || !same(saved.state, state)) return back('expired')
  const access = await writerAccess()
  if (!access?.personId || access.personId !== saved.personId || !access.can('agenda')) return back('signin')
  // "Decline" on Zoom's page.
  if (url.searchParams.get('error')) return back('cancelled')
  const code = url.searchParams.get('code')
  if (!code) return back('cancelled')

  const app = await loadZoomApp()
  if (!app) return back('no_app')
  try {
    const answer = await exchangeZoomCode(app, code, `${base}${ZOOM_CALLBACK_PATH}`)
    const who = await zoomMe(answer.access_token)
    if (!who) return back('failed')
    const r = await saveZoomConnection({ personId: access.personId, zoomUserId: who.id, email: who.email, answer })
    if (!r.ok) return back(r.reason, who.email)
    revalidatePath('/agenda/settings'); revalidatePath('/agenda')
    return back('connected', who.email)
  } catch (e) {
    console.error('[agenda zoom] callback:', e instanceof Error ? e.message : e)
    return back('failed')
  }
}
