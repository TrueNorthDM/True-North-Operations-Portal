// Extra hours (Clocky part 2, Requests.dc.html 10C, 10E): asked before going
// over the hours allowance, by the person or their Team Leader; a Super Admin
// decides on Approvals. The data is lib/timeclock/requests-data.ts.

import { requireSurface } from '@/lib/access/resolve'
import { viewerFor } from '@/lib/timeclock/clocky-context'
import { loadExtraHours } from '@/lib/timeclock/requests-data'
import { ExtraHoursLive } from '@/components/requests/RequestsLive'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Extra hours' }

export default async function ExtraHoursRoute() {
  const access = await requireSurface('rq-extra-hours')
  const v = await viewerFor(access)
  const data = v ? await loadExtraHours({ personId: v.personId, ledTeamIds: v.ledTeamIds }, v.zone) : null
  if (!data) return <p role="alert" className="m-0 text-[13px] font-semibold text-[#c8323d]">Your login is not linked to anyone in the Directory.</p>
  return <ExtraHoursLive data={data} />
}
