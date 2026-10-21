// Time off (Clocky part 2, Requests.dc.html 7A to 7E): US employees ask for
// days off; Super Admins and Admins also see everyone's. What the page holds
// is lib/timeclock/time-off-data.ts; the decisions are on Approvals.

import { requireSurface } from '@/lib/access/resolve'
import { viewerFor } from '@/lib/timeclock/clocky-context'
import { loadTimeOff } from '@/lib/timeclock/time-off-data'
import { TimeOffLive } from '@/components/requests/RequestsLive'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Time off' }

export default async function TimeOffPageRoute() {
  const access = await requireSurface('rq-time-off')
  const v = await viewerFor(access)
  const data = await loadTimeOff(access, v?.zone ?? 'America/New_York')
  if (!data) {
    return <p role="alert" className="m-0 text-[13px] font-semibold text-[#c8323d]">Your login is not linked to anyone in the Directory.</p>
  }
  return <TimeOffLive data={data} />
}
