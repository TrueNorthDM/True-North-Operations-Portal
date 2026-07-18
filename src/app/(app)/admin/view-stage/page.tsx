import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import ViewStageClient from './ViewStageClient'

// View Stage lives inside /admin — a preview of the portal through each
// permission tier. Impersonation is server-render only (writes use the real
// session); it travels by token on the iframe URLs (?_vs=), so this control
// page never self-impersonates. force-dynamic: identity resolves per request.
export const dynamic = 'force-dynamic'

export default async function ViewStagePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!(await isCurrentUserAdmin())) redirect('/')
  const me = await loadCurrentPerson(supabase, user)
  return <ViewStageClient myName={me?.full_name ?? user.email ?? 'Admin'} />
}
