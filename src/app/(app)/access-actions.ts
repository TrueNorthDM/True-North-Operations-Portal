'use server'

// Records one portal-access row for the signed-in user. Called from AccessPing
// (throttled client-side to about once per visit). RLS lets a user insert only
// their own row; reads are admin-only.

import { verifiedSession } from '@/lib/access/resolve'
import { headers } from 'next/headers'

export async function logAccess(): Promise<void> {
  // Only a session that may use the portal is recorded as an access.
  const session = await verifiedSession()
  if (!session) return
  const { supabase, user } = session
  const ua = (await headers()).get('user-agent') ?? null
  const { data: person } = await supabase.from('people').select('id, full_name').eq('profile_id', user.id).maybeSingle()
  await supabase.from('access_log').insert({
    profile_id: user.id,
    person_id: person?.id ?? null,
    email: user.email ?? null,
    name: person?.full_name ?? null,
    user_agent: ua,
  })
}
