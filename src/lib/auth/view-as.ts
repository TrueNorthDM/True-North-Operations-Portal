// view-as.ts: signed impersonation tokens for the View Stage (admin preview of
// each permission tier).
//
// A token carries WHICH LEVEL to preview and the admin who signed it, and
// deliberately NOT which person: the representative is resolved live on every
// request (see current-person.ts). Freezing the person into the token made the
// preview go stale the moment an admin changed anyone's level, showing one
// level's interface with a person who had since moved to another.
//
// It only changes what the app RENDERS (writes always use the real session).
// HMAC-SHA256 with the server-only service-role key as the secret. Node-only
// (crypto), client code must `import type` from here.

import { createHmac, timingSafeEqual } from 'crypto'

export type ViewAsRole = 'admin' | 'admin_assistant' | 'team_leader' | 'user'
const ROLES: ViewAsRole[] = ['admin', 'admin_assistant', 'team_leader', 'user']

/** Query param on the iframe URL and the request header the middleware relays it to. */
export const VS_PARAM = '_vs'
export const VS_HEADER = 'x-vs'

export interface ViewAsPayload {
  sadmin: string   // the real admin who signed this (only they may use it)
  role: ViewAsRole // the level being previewed; the person is resolved live
  exp: number      // epoch ms expiry
}

function secret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

export function signViewAs(p: ViewAsPayload): string {
  const body = Buffer.from(JSON.stringify(p)).toString('base64url')
  const sig = createHmac('sha256', secret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

/** Verify signature + expiry + shape. Returns the payload or null. */
export function verifyViewAs(token: string | null | undefined): ViewAsPayload | null {
  const s = secret()
  if (!token || !s) return null
  const dot = token.indexOf('.')
  if (dot < 1) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = createHmac('sha256', s).update(body).digest('base64url')
  try {
    const a = Buffer.from(sig, 'base64url')
    const b = Buffer.from(expected, 'base64url')
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  let p: ViewAsPayload
  try {
    p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (!p || typeof p.sadmin !== 'string' || typeof p.exp !== 'number') return null
  if (p.exp < Date.now() || !ROLES.includes(p.role)) return null
  return p
}
