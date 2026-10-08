// Admin → Tickets, the dev work tracker. Admin-only (same server guard as the
// Admin hub). Data lives in lib/tickets/data.ts, maintained in the repo.

import { requireSurface } from '@/lib/access/resolve'
import { TicketsClient } from '@/components/TicketsClient'

export default async function TicketsPage() {
  const access = await requireSurface('tickets')
  return <TicketsClient canOpenAdmin={access.can('admin')} />
}
