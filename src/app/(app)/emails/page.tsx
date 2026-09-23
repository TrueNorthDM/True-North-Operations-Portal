// Emails: Coming soon (navigation redesign, 22 September 2026). A real route so
// the rail can show it and a link can be shared ahead of launch.

import { ComingSoon } from '@/components/ComingSoon'
import { requireSurface } from '@/lib/access/resolve'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Emails' }

export default async function Page() {
  const access = await requireSurface('emails')
  return (
    <ComingSoon
      icon="emails"
      title="Emails"
      description="The team's email, inside the portal."
      self="/emails"
      canSuggest={access.isAdmin}
    />
  )
}
