// Admin → System manual. Security admins only: the "How it runs" tab names the
// server, its accounts and where the keys live. Two tabs (ManualHeader):
// "The portal" (lib/manual/data.ts, SystemManual) and "How it runs" (HowItRuns).

import { redirect } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'
import { SystemManual } from '@/components/SystemManual'
import { HowItRuns } from '@/components/manual/HowItRuns'
import { ManualHeader, type ManualTab } from '@/components/manual/ManualHeader'

export default async function ManualPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const access = await requireSurface('manual')
  // Each tab is an item of its own (man-portal, man-runs).
  const open: ManualTab[] = (['portal', 'runs'] as const).filter(t => access.can(t === 'portal' ? 'man-portal' : 'man-runs'))
  if (!open.length) redirect('/admin')
  const { tab } = await searchParams
  const asked: ManualTab = tab === 'runs' ? 'runs' : 'portal'
  const active: ManualTab = open.includes(asked) ? asked : open[0]
  return (
    <div className="space-y-6">
      <ManualHeader active={active} tabs={open} />
      {active === 'runs' ? <HowItRuns /> : <SystemManual />}
    </div>
  )
}
