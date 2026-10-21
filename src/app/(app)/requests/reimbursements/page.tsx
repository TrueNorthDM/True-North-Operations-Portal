// Reimbursements (Clocky part 2, Requests.dc.html 9A, 9B): money spent for
// work, asked for with the receipt. A contractor's goes on their next invoice;
// an employee's on a reimbursement document Finance pays. Super Admins decide
// on Approvals. The data is lib/timeclock/requests-data.ts.

import { requireSurface } from '@/lib/access/resolve'
import { viewerFor } from '@/lib/timeclock/clocky-context'
import { loadReimbursements } from '@/lib/timeclock/requests-data'
import { ReimbursementsLive } from '@/components/requests/RequestsLive'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Reimbursements' }

export default async function ReimbursementsRoute() {
  const access = await requireSurface('rq-reimbursements')
  const v = await viewerFor(access)
  const data = await loadReimbursements(access, v?.zone ?? 'America/New_York')
  if (!data) return <p role="alert" className="m-0 text-[13px] font-semibold text-[#c8323d]">Your login is not linked to anyone in the Directory.</p>
  return <ReimbursementsLive data={data} />
}
