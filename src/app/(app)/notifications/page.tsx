// Notification settings, opened from the two notification drawers: Coming soon (navigation redesign, 22 September 2026). A real route so
// the rail can show it and a link can be shared ahead of launch.

import { ComingSoon } from '@/components/ComingSoon'
import { requireSurface } from '@/lib/access/resolve'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Notification settings' }

export default async function Page() {
  const access = await requireSurface('home')
  return (
    <ComingSoon
      icon="bell"
      title="Notification settings"
      description="What notifies you, and where: in the portal, by email or on Slack. The rules are being set up."
      canSuggest={access.isAdmin}
    />
  )
}
