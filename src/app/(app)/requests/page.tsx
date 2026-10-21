// Requests (Clocky part 2): the hub has no page of its own; its trail leads
// here, which opens the first one that is the person's.

import { redirect } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'
import { previewHref } from '@/lib/auth/view-as-server'
import { loadNavFacts } from '@/lib/access/nav-facts'

export default async function RequestsPage() {
  const access = await requireSurface('rq-reimbursements')
  const facts = await loadNavFacts(access)
  redirect(await previewHref(access.can('rq-time-off') && facts.has('employee') ? '/requests/time-off' : '/requests/reimbursements'))
}
