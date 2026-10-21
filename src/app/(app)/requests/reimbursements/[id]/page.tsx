// A reimbursement document (Clocky part 2, Requests.dc.html 9D): an employee's
// approved items for Finance to pay. Open to the person, Super Admins, Admins
// and Finance; never Team Leaders (lib/timeclock/requests-data.ts).

import { notFound } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'
import { viewerFor } from '@/lib/timeclock/clocky-context'
import { loadRmbDocPage } from '@/lib/timeclock/requests-data'
import { RmbDocLive } from '@/components/requests/RequestsLive'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Reimbursements' }

export default async function RmbDocRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const access = await requireSurface('rq-reimbursements')
  if (!/^\d+$/.test(id)) notFound()
  const v = await viewerFor(access)
  const d = await loadRmbDocPage(access, Number(id), v?.zone ?? 'America/New_York')
  // Closed and missing look the same.
  if (!d) notFound()
  return <RmbDocLive d={d} />
}
