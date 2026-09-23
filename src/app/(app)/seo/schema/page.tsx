// The Schema App tool: Coming soon (navigation redesign, 22 September 2026). A real route so
// the rail can show it and a link can be shared ahead of launch.

import { ComingSoon } from '@/components/ComingSoon'
import { redirect } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Schema App' }

export default async function Page() {
  const access = await requireSurface('tools')
  // Granted per team like every tool (Directory → Teams), from today.
  if (!access.canTool('schema-app')) redirect('/')
  return (
    <ComingSoon
      icon="schema-app"
      title="Schema App"
      description="Write and publish schema markup for the sites' pages."
      canSuggest={access.isAdmin}
    />
  )
}
