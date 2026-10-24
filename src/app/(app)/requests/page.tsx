// Requests (Clocky part 2): the hub has no page of its own; its trail leads
// here, which opens the first one that is the person's. Anyone with any of
// the three gets in (a Super Admin can close one and leave the others open).

import { redirect } from 'next/navigation'
import { loadAccess } from '@/lib/access/resolve'
import { previewHref } from '@/lib/auth/view-as-server'
import { loadNavFacts } from '@/lib/access/nav-facts'

export default async function RequestsPage() {
  const access = await loadAccess()
  const timeOff = access.can('rq-time-off'), rmb = access.can('rq-reimbursements'), extra = access.can('rq-extra-hours')
  if (!timeOff && !rmb && !extra) redirect(await previewHref('/'))
  // Time off is an employee's; a contractor who holds it still lands on it when it is all they have.
  const employee = timeOff && (await loadNavFacts(access)).has('employee')
  const to = employee ? '/requests/time-off'
    : rmb ? '/requests/reimbursements'
      : extra ? '/requests/extra-hours'
        : '/requests/time-off'
  redirect(await previewHref(to))
}
