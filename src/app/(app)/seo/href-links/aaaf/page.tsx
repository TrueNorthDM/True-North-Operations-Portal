// AAAF: the Href Links page list (server component). The page itself lives in
// components/href-links/SiteListPage.tsx, shared with the other site; this
// route keeps its own access check, so a reader can see it is guarded.

import { redirect } from 'next/navigation'
import { previewHref } from '@/lib/auth/view-as-server'
import { requireSurface } from '@/lib/access/resolve'
import { SiteListPage } from '@/components/href-links/SiteListPage'

export default async function AaafPagesPage() {
  // Href Links is a tool in the rail's Tools panel (SEO Tools), not a rail
  // item, so it needs the area plus its own team grant. Both sites are open
  // to everyone with the tool (13 October 2026).
  const access = await requireSurface('tools')
  if (!access.canTool('href-links')) redirect(await previewHref('/'))

  return <SiteListPage code="aaaf" />
}
