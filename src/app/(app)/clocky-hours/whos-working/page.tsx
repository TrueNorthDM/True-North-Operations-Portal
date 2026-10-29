// Clocky > Who's working (design handoff of 16 October 2026, Who's
// Working.dc.html frame 2P): the top bar drawer's list as a page. Team Leaders
// (their teams), Admins and Super Admins (everyone): ck-whos-working. At a
// level without it the page is not in Clocky's menu, and its address opens
// the person's own Time entries.

import { redirect } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'
import { previewHref } from '@/lib/auth/view-as-server'
import { getCurrentPerson } from '@/lib/auth/session'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { WhosWorkingPage } from '@/components/clocky/working/WhosWorkingPage'
import { getWhosWorking } from './actions'
import { requireNorthTimeOpen } from '@/lib/timeclock/north-time-gate'

export const dynamic = 'force-dynamic'
export const metadata = { title: "Who's working" }

export default async function Page() {
  await requireNorthTimeOpen()
  const access = await requireSurface('clocky-hours')
  if (!access.can('ck-whos-working')) redirect(await previewHref('/clocky-hours'))
  const [res, me] = await Promise.all([getWhosWorking(), getCurrentPerson()])
  return (
    <div>
      <Breadcrumb parents={['/clocky-hours']} now="Who's working" />
      <WhosWorkingPage initial={res} meName={me?.full_name ?? ''} />
    </div>
  )
}
