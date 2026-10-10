// Chat: Coming soon (navigation redesign, 22 September 2026). A real route so
// the rail can show it and a link can be shared ahead of launch.

import { ComingSoon } from '@/components/ComingSoon'
import { requireSurface } from '@/lib/access/resolve'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Chat' }

export default async function Page() {
  await requireSurface('chat')
  return (
    <ComingSoon
      icon="chat"
      title="Chat"
      description="Internal chat for the company. Where the team talks without leaving the portal."
      self="/chat"
    />
  )
}
