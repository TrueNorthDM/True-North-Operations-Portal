'use server'

// Records one portal-access row for the signed-in user. Called from AccessPing
// (throttled client-side to about once per visit). RLS lets a user insert only
// their own row; reads are admin-only.

import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

export async function logAccess(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
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
