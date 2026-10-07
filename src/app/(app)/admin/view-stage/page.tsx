import { redirect } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'
import ViewStageClient from './ViewStageClient'
import { getCurrentPerson, getSessionUser } from '@/lib/auth/session'

// View Stage lives inside /admin, a preview of the portal through each
// permission tier. Impersonation is server-render only (writes use the real
// session); it travels by token on the iframe URLs (?_vs=), so this control
// page never self-impersonates. force-dynamic: identity resolves per request.
export const dynamic = 'force-dynamic'

export default async function ViewStagePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  await requireSurface('view-stage')
  const me = await getCurrentPerson()
  return <ViewStageClient myName={me?.full_name ?? user.email ?? 'Admin'} />
}
