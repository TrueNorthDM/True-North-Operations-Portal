// Client Reports: the index of the client reports (navigation redesign, 22
// September 2026). Each report is still its own team grant, so this opens the
// first one the person may see, and the reports carry the tabs between them
// when there is more than one (ClientReportTabs).

import { redirect } from 'next/navigation'
import { previewHref } from '@/lib/auth/view-as-server'
import { requireSurface } from '@/lib/access/resolve'
import { clientReportTabs } from '@/components/ClientReportTabs'

export const dynamic = 'force-dynamic'

export default async function ClientReportsIndex({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const access = await requireSurface('tools')
  const [first] = clientReportTabs(access.canTool)
  if (!first) redirect(await previewHref('/'))
  // The query rides along, so a pasted ?month= still lands on its month.
  const q = new URLSearchParams(await searchParams).toString()
  redirect(await previewHref(q ? `${first.href}?${q}` : first.href))
}
