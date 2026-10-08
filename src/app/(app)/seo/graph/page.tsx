// The Knowledge Graph tool: Coming soon (navigation redesign, 22 September 2026). A real route so
// the rail can show it and a link can be shared ahead of launch.

import { ComingSoon } from '@/components/ComingSoon'
import { previewHref } from '@/lib/auth/view-as-server'
import { redirect } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Knowledge Graph' }

export default async function Page() {
  const access = await requireSurface('tools')
  // Granted per team like every tool (Directory → Teams), from today.
  if (!access.canTool('knowledge-graph')) redirect(await previewHref('/'))
  return (
    <ComingSoon
      icon="knowledge-graph"
      title="Knowledge Graph"
      description="The entities in our schema and how they connect across pages."
      canSuggest={access.can('tickets')}
    />
  )
}
