// Company settings > North Time rollout > Clocked in TSheets after switching
// (owner, 27 October 2026): the TSheets entries dated on or after their
// person's North Time start date. The import keeps them aside, whole, instead
// of writing them as hours (lib/timeclock/waves.ts, splitByStart), so someone
// decides what each one was: Count it (a Time entry) or Discard it. Super
// Admins and Admins read them (cs-rollout) and decide them (cs-rollout-decide,
// checked again in skipped-actions.ts).

import { redirect } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'
import { previewHref } from '@/lib/auth/view-as-server'
import { Breadcrumb, adminCrumb } from '@/components/ui/Breadcrumb'
import { createAdminClient } from '@/lib/supabase/admin'
import { viewerFor } from '@/lib/timeclock/clocky-context'
import { loadSkippedEntries } from '@/lib/timeclock/waves-data'
import { zoneAbbr } from '@/lib/timeclock/format'
import { splitDecided } from '@/lib/timeclock/skipped-decisions'
import { SkippedList } from '@/components/settings/SkippedList'
import { decideSkipped } from '../skipped-actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Clocked in TSheets after switching' }

export default async function TsheetsAfterSwitchPage() {
  const access = await requireSurface('settings')
  if (!access.can('cs-rollout')) redirect(await previewHref('/admin/settings'))
  const [entries, viewer] = await Promise.all([loadSkippedEntries(createAdminClient()), viewerFor(access)])
  const zone = viewer?.zone ?? 'America/New_York'
  const abbr = zoneAbbr(zone, new Date())
  const undecided = splitDecided(entries).todo.length
  const canDecide = access.can('cs-rollout-decide')

  return (
    <div className="space-y-[22px]">
      <div>
        <Breadcrumb parents={[adminCrumb(access.can('admin')), '/admin/settings']} now="Clocked in TSheets after switching" />
        <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] text-tn-ink m-0 leading-[normal] flex flex-wrap items-center gap-x-3 gap-y-1" style={{ letterSpacing: '-.01em' }}>
          Clocked in TSheets after switching
          {undecided > 0 && (
            <span className="font-(family-name:--font-display) font-extrabold text-[13px] tracking-normal text-tn-ink bg-[#F2C40A] rounded-full px-2.5 py-0.5 tabular-nums lining-nums leading-[normal]">
              {undecided} to decide
            </span>
          )}
        </h1>
        <p className="mt-1.5 text-[15px] text-muted leading-normal">
          TSheets entries dated on or after their person&apos;s North Time start date. The import did not write them as hours: each one is kept here, whole, until someone decides what it was. Count it makes it a Time entry for that person, open; Discard it makes none. Times in {abbr}.
        </p>
      </div>

      <SkippedList entries={entries} zone={zone} abbr={abbr} canDecide={canDecide} decide={decideSkipped} />
    </div>
  )
}
