// Clocky > Clock safety (design handoff of 16 October 2026, Clock Safety.dc.html
// frames 4A and 4B): every automatic clock-out. Admins and Super Admins
// (ck-safety; read only below Super Admin). At a level without it the page is
// not in Clocky's menu, and its address opens the person's own Time entries.

import { redirect } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'
import { previewHref } from '@/lib/auth/view-as-server'
import { ClockSafety } from '@/components/clocky/safety/ClockSafety'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { getClockSafety } from './actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Clock safety' }

export default async function ClockSafetyPage() {
  const access = await requireSurface('clocky-hours')
  if (!access.can('ck-safety')) redirect(await previewHref('/clocky-hours'))
  const res = await getClockSafety({ period: 'month' })
  if (!res.ok) {
    return (
      <div className="space-y-2">
        <Breadcrumb parents={['/clocky-hours']} now="Clock safety" />
        <h1 className="m-0 font-(family-name:--font-display) font-extrabold text-[30px] text-tn-ink">Clock safety</h1>
        <p role="alert" className="m-0 text-[13.5px] text-[#c8323d]">{res.error}</p>
      </div>
    )
  }
  return <ClockSafety initial={res.data} />
}
