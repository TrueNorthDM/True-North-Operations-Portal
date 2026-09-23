// The Page Auditor tool: Coming soon (navigation redesign, 22 September 2026). A real route so
// the rail can show it and a link can be shared ahead of launch.

import { ComingSoon } from '@/components/ComingSoon'
import { redirect } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Page Auditor' }

export default async function Page() {
  const access = await requireSurface('tools')
  // Granted per team like every tool (Directory → Teams), from today.
  if (!access.canTool('page-auditor')) redirect('/')
  return (
    <ComingSoon
      icon="page-auditor"
      title="Page Auditor"
      description="Technical checks on a page: titles, headings, links, speed."
      canSuggest={access.isAdmin}
    />
  )
}
