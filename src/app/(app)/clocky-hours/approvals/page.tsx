// Clocky → Approvals and Invoices: Coming soon (navigation redesign, 22 September 2026). A real route so
// the rail can show it and a link can be shared ahead of launch.

import { ComingSoon } from '@/components/ComingSoon'
import { requireSurface } from '@/lib/access/resolve'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Approvals and Invoices' }

export default async function Page() {
  const access = await requireSurface('clocky-hours')
  return (
    <ComingSoon
      icon="tests"
      title="Approvals and Invoices"
      description="The approval queue and the invoices raised from approved hours."
      parents={['/clocky-hours']}
      canSuggest={access.isAdmin}
    />
  )
}
