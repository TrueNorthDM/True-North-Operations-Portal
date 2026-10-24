// Extra hours (Clocky part 2, Requests.dc.html 10C, 10E): asked before going
// over the hours allowance, by the person or their Team Leader; a Super Admin
// decides on Approvals. The data is lib/timeclock/requests-data.ts.

import { requireSurface } from '@/lib/access/resolve'
import { viewerFor } from '@/lib/timeclock/clocky-context'
import { loadExtraHours } from '@/lib/timeclock/requests-data'
import { ExtraHoursLive } from '@/components/requests/RequestsLive'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Extra hours' }

export default async function ExtraHoursRoute({ searchParams }: { searchParams: Promise<{ ask?: string }> }) {
  const access = await requireSurface('rq-extra-hours')
  const v = await viewerFor(access)
  const data = v ? await loadExtraHours({ personId: v.personId, ledTeamIds: v.ledTeamIds }, v.zone) : null
  if (!data) return <p role="alert" className="m-0 text-[13px] font-semibold text-[#c8323d]">Your login is not linked to anyone in the Directory.</p>
  // ?ask=1 (the clock panel's "Ask for extra hours", 10B-2, and the allowance bell line): the form already open, as 10C.
  return <ExtraHoursLive data={data} ask={(await searchParams).ask === '1'} />
}
