// Admin > System manual. Two tabs (ManualHeader), each an item of its own:
// "The portal" (SystemManual, man-portal) and "How it runs" (HowItRuns,
// man-runs). How it runs is Super Admin only (audit, 10 October 2026): it
// names the server, its accounts and where the key files live.

import { redirect } from 'next/navigation'
import { previewHref } from '@/lib/auth/view-as-server'
import { requireSurface } from '@/lib/access/resolve'
import { CATALOGUE, ITEM } from '@/lib/access/catalogue'
import { SystemManual } from '@/components/SystemManual'
import { HowItRuns } from '@/components/manual/HowItRuns'
import { ManualHeader, type ManualTab } from '@/components/manual/ManualHeader'

/**
 * The catalogue's Super Admin only items, for the manual's Access section.
 * Read here on the server because client code never imports the catalogue
 * (it names every page, Super Admin ones included). A tab or action reads
 * with its page: "Company settings > APIs & tokens".
 */
function superOnlyLabels(): string[] {
  return CATALOGUE.filter(i => i.superOnly).map(i => {
    const label = i.label.replace(', with Check a person, Exceptions and the change log', '')
    const parent = i.parent ? ITEM.get(i.parent) : undefined
    return (i.kind === 'tab' || i.kind === 'action') && parent ? `${parent.label} > ${label}` : label
  })
}

export default async function ManualPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const access = await requireSurface('manual')
  // Each tab is an item of its own (man-portal, man-runs).
  const open: ManualTab[] = (['portal', 'runs'] as const).filter(t => access.can(t === 'portal' ? 'man-portal' : 'man-runs'))
  if (!open.length) redirect(await previewHref(access.can('admin') ? '/admin' : '/'))
  const { tab } = await searchParams
  const asked: ManualTab = tab === 'runs' ? 'runs' : 'portal'
  const active: ManualTab = open.includes(asked) ? asked : open[0]
  return (
    <div className="space-y-6">
      <ManualHeader active={active} tabs={open} canOpenAdmin={access.can('admin')} />
      {active === 'runs' ? <HowItRuns /> : <SystemManual superOnly={superOnlyLabels()} />}
    </div>
  )
}
