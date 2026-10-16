// Clocky, Approvals (design handoff of 16 October 2026, README "Time
// correction requests and approvals", frames 3L and 3L2): the time
// corrections waiting for the viewer's decision in their scope (their teams
// for a Team Leader, everyone for Admins and Super Admins), and time off for
// Super Admins. The data and every decision are approvals/actions.ts.

import { requireSurface } from '@/lib/access/resolve'
import { ApprovalsLive } from '@/components/clocky/approvals/ApprovalsLive'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { getApprovals } from './actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Approvals' }

export default async function ApprovalsPage() {
  await requireSurface('clocky-approvals')
  const r = await getApprovals()
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
