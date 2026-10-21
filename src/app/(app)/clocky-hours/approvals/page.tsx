// Clocky, Approvals (Clocky part 2, Approvals.dc.html AP to AP-D): one queue
// of timesheets, time off, reimbursements, extra hours and time corrections,
// in three tabs (Waiting for you, With others, Decided), decided by the
// routing of README_PART2. The data and every decision are approvals/actions.ts.

import { requireSurface } from '@/lib/access/resolve'
import { ApprovalsLive } from '@/components/clocky/approvals/ApprovalsLive'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { getQueue } from './actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Approvals' }

export default async function ApprovalsPage() {
  await requireSurface('clocky-approvals')
  const r = await getQueue()
  if (!r.ok) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <Breadcrumb parents={['/clocky-hours']} now="Approvals" />
          <h1 className="m-0 mt-0.5 font-(family-name:--font-display) font-extrabold text-[30px] text-tn-ink" style={{ letterSpacing: '-.01em' }}>Approvals</h1>
        </div>
        <p role="alert" className="m-0 text-[13px] font-semibold text-[#c8323d]">{r.error}</p>
      </div>
    )
  }
  return <ApprovalsLive initialData={r.data} />
}
