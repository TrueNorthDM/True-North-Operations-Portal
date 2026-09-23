// The Impact Globe tool: Coming soon (navigation redesign, 22 September 2026). A real route so
// the rail can show it and a link can be shared ahead of launch.

import { ComingSoon } from '@/components/ComingSoon'
import { redirect } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Impact Globe' }

export default async function Page() {
  const access = await requireSurface('tools')
  // Granted per team like every tool (Directory → Teams), from today.
  if (!access.canTool('impact-globe')) redirect('/')
  return (
    <ComingSoon
      icon="impact-globe"
      title="Impact Globe"
      description="Where in the world the sites are being read."
      canSuggest={access.isAdmin}
    />
  )
}
