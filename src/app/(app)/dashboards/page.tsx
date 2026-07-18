// Dashboards was merged into Tools & Dashboards (/tools). This landing now
// redirects there; the sub-pages (/dashboards/publishing) keep their own paths.

import { redirect } from 'next/navigation'

export default function DashboardsPage() {
  redirect('/tools')
}
