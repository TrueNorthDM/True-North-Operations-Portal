// My Hours → Reports: Coming soon (navigation redesign, 22 September 2026). A real route so
// the rail can show it and a link can be shared ahead of launch.

import { ComingSoon } from '@/components/ComingSoon'
import { requireSurface } from '@/lib/access/resolve'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Reports' }

export default async function Page() {
  const access = await requireSurface('my-hours-reports')
  return (
    <ComingSoon
      icon="client-reports"
      title="Reports"
      description="Your own hours over time, by week, month and project."
      parents={['/hours']}
      canSuggest={access.isAdmin}
    />
  )
}
