// Dashboards was merged into Tools & Dashboards (/tools). This landing now
// redirects there; the sub-pages (/dashboards/publishing) keep their own paths.

import { redirect } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'

export default async function DashboardsPage() {
  await requireSurface('tools')

  redirect('/tools')
}
