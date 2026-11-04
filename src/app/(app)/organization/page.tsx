// Organization: the org chart moved into Human Resources (the owner, 4 November
// 2026), as the block before the anniversaries. This address stays so old
// links still land somewhere: it sends them there.

import { redirect } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'
import { previewHref } from '@/lib/auth/view-as-server'

export const dynamic = 'force-dynamic'

export default async function OrganizationPage() {
  await requireSurface('organization')
  redirect(await previewHref('/human-resources'))
}
