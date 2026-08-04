// Admin → Tickets, the dev work tracker. Admin-only (same server guard as the
// Admin hub). Data lives in lib/tickets/data.ts, maintained in the repo.

import { redirect } from 'next/navigation'
import { isSecurityAdmin } from '@/lib/auth/role'
import { TicketsClient } from '@/components/TicketsClient'

export default async function TicketsPage() {
  if (!(await isSecurityAdmin())) redirect('/')
  return <TicketsClient />
}
