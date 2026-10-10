// The Schema Scraper tool: Coming soon (navigation redesign, 22 September 2026). A real route so
// the rail can show it and a link can be shared ahead of launch.

import { ComingSoon } from '@/components/ComingSoon'
import { previewHref } from '@/lib/auth/view-as-server'
import { redirect } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Schema Scraper' }

export default async function Page() {
  const access = await requireSurface('tools')
  // Granted per team like every tool (Directory → Teams), from today.
  if (!access.canTool('schema-scraper')) redirect(await previewHref('/'))
  return (
    <ComingSoon
      icon="schema-scraper"
      title="Schema Scraper"
      description="Pull the schema off any URL to read it and compare it with ours."
    />
  )
}
