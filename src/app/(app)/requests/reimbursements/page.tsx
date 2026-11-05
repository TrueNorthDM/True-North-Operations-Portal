// Reimbursements (Clocky part 2, Requests.dc.html 9A, 9B): money spent for
// work, asked for with the receipt. A contractor's goes on their next invoice;
// an employee's on a reimbursement document Finance pays. The Reimbursements
// list (Company settings, Who approves what) decides on Approvals. Super Admins and Finance also see everyone's, and
// every reimbursement document (Documents). The data is
// lib/timeclock/requests-data.ts.

import { requireSurface } from '@/lib/access/resolve'
import { viewerFor } from '@/lib/timeclock/clocky-context'
import { loadReimbursements } from '@/lib/timeclock/requests-data'
import { ReimbursementsLive } from '@/components/requests/RequestsLive'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Reimbursements' }

const STATES = ['all', 'appr', 'paid'] as const

/**
 * ?view=documents opens the Documents view, for the people who see everyone's
 * (the rest get their own list); &state=appr opens it on the ones to pay, as
 * Home's "Reimbursements to pay" line links (owner, 25 October 2026).
 */
export default async function ReimbursementsRoute({ searchParams }: { searchParams: Promise<{ view?: string; state?: string }> }) {
  const { view, state } = await searchParams
  const access = await requireSurface('rq-reimbursements')
  const v = await viewerFor(access)
  const data = await loadReimbursements(access, v?.zone ?? 'America/New_York')
  // Try again on a failed Drive copy is a Super Admin's, as on the Google Drive card.
  if (data?.documents?.drive) data.documents.drive.retry = access.can('cs-integrations-edit')
  if (!data) return <p role="alert" className="m-0 text-[13px] font-semibold text-[#c8323d]">Your login is not linked to anyone in the Directory.</p>
  return <ReimbursementsLive data={data} documents={view === 'documents' && data.documents ? { st: STATES.find(x => x === state) } : undefined} />
}
