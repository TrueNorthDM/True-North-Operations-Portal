// view-as-server.ts: resolve the active View Stage impersonation for THIS
// request. The middleware relays the iframe's ?_vs=<token> into the x-vs request
// header; here we verify it and confirm the current (real) user is the admin who
// signed it, so a leaked token can't be used by anyone else.

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { verifyViewAs, VS_HEADER, type ViewAsRole } from '@/lib/auth/view-as'

export interface ViewAs {
  pid: string
  role: ViewAsRole
}

export async function getViewAs(): Promise<ViewAs | null> {
  const h = await headers()
  const payload = verifyViewAs(h.get(VS_HEADER))
  if (!payload) return null
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== payload.sadmin) return null // only the signing admin
  return { pid: payload.pid, role: payload.role }
}
