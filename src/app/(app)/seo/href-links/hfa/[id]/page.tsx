// HFA: one Href Links page (server component). The page itself lives in
// components/href-links/SitePageDetail.tsx, shared with the other site; this
// route keeps its own access check, so a reader can see it is guarded.

import { redirect } from 'next/navigation'
import { previewHref } from '@/lib/auth/view-as-server'
import { requireSurface } from '@/lib/access/resolve'
import { SitePageDetail } from '@/components/href-links/SitePageDetail'

export default async function HfaPageDetail({ params }: { params: Promise<{ id: string }> }) {
  // Href Links, so the area plus its team grant. Both sites are open to
  // everyone with the tool (13 October 2026).
  const access = await requireSurface('tools')
  if (!access.canTool('href-links')) redirect(await previewHref('/'))

  const { id } = await params
  return <SitePageDetail code="hfa" id={id} />
}
