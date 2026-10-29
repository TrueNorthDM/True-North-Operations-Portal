// North Time > TSheets transition (27 October 2026): while TSheets and North
// Time run side by side, every TSheets entry dated on or after the switch date,
// as TSheets recorded it and as the portal reads
// it, problems first. TSheets keeps its old jobs and fields (owner, 29 October
// 2026), so the portal side is each entry translated into the 2026 structure.
// Super Admins and Admins (ck-transition). At a level
// without it the page is not in North Time's menu, and its address opens the
// person's own Time entries. Reading only: nothing here changes an entry.
//
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD   the period (from the switch date by default)
//   ?person=<id>                     one person
//   ?problems=1                      only the entries with a problem

import { redirect } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'
import { previewHref } from '@/lib/auth/view-as-server'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { TransitionLive } from '@/components/clocky/transition/TransitionReport'
import { loadTransition } from '@/lib/timeclock/transition-data'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'TSheets transition' }

export default async function TransitionPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; person?: string; problems?: string }> }) {
  const access = await requireSurface('clocky-hours')
  if (!access.can('ck-transition')) redirect(await previewHref('/clocky-hours'))
  const sp = await searchParams
  const data = await loadTransition({ from: sp.from, to: sp.to, person: sp.person, problems: sp.problems === '1' })
    .catch((e: Error) => { console.error('[clocky transition]', e.message); return null })
  if (!data) {
    return (
      <div className="space-y-2">
        <Breadcrumb parents={['/clocky-hours']} now="TSheets transition" />
        <h1 className="m-0 font-(family-name:--font-display) font-extrabold text-[30px] text-tn-ink">TSheets transition</h1>
        <p role="alert" className="m-0 text-[13.5px] text-[#c8323d]">The TSheets entries could not be read. Try again in a moment.</p>
      </div>
    )
  }
  return <TransitionLive data={data} />
}
