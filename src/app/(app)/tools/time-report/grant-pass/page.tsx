// Client Report, Project Hours & Others.
//
// This page was "Grant Pass" while nobody knew what it was for. Accounting's own
// tracking sheet settled it: Grants Pass is two rows of a four-project sheet,
// beside AskAnAdventistFriend.com and Hope for Africa, and what it tracks is
// hours rather than money. So the page is that sheet.
//
// It keeps the 'grant-pass-report' tool grant. The key is what permissions are
// stored against, and renaming it would silently revoke access for whoever has
// it today.

import { redirect } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { currentYearMonth } from '@/lib/tsheets/report'
import { availableMonths } from '@/lib/tsheets/retention'
import { loadProjectTracking } from '@/lib/timeclock/projects'
import { ProjectHoursReport } from '@/components/tsheets/ProjectHoursReport'
import { MonthPicker } from '@/components/tsheets/MonthPicker'
import { ManualHoursDialog } from '@/components/tsheets/ManualHoursDialog'
import { loadAllManualHours } from '@/lib/timeclock/manual-data'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

export const metadata = { title: 'Client Report · Project Hours & Others' }
export const dynamic = 'force-dynamic'

const MANUAL_BLURB =
  'Every hour added by hand this month, whichever client it belongs to. They count in the client reports exactly like an imported hour, which is why they are listed here rather than only totalled.'

export default async function ProjectHoursPage({
  searchParams,
}: { searchParams: Promise<{ month?: string }> }) {
  // The area comes from the level, the report from its own team tool grant.
  const access = await requireSurface('tools')
  if (!access.canTool('grant-pass-report')) redirect('/tools')

  const months = availableMonths(new Date())
  const { month } = await searchParams
  const selected = month && months.includes(month) ? month : months[0] ?? currentYearMonth()

  // Privileged, for the reason the i7 report was wrong until 2026-09-01.
  //
  // tc_entries carries the time clock's row-level security: you read your own
  // hours plus the hours of people you approve. A client report read through
  // that rule means a different thing for every viewer, and it fails silently,
  // as a smaller number rather than an error. Who may open this page is the
  // tools surface plus the grant-pass-report team grant, checked right above,
  // and that is the rule an admin can actually see.
  const data = await loadProjectTracking(createAdminClient(), selected)

  // Admins only: these hours reach a client report.
  const manual = access.isAdmin
    ? { ...(await loadAllManualHours(createAdminClient(), selected)), blurb: MANUAL_BLURB }
    : undefined

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <Breadcrumb parents={['/tools']} now="Client Report · Project Hours & Others" />
        <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">
          Client Report · Project Hours &amp; Others
        </h1>
        <p className="mt-1.5 text-muted leading-relaxed">
          AskAnAdventistFriend.com, Grants Pass Church and School, and Hope for Africa. Hours by
          person and by month, the same shape as the tracking sheet.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <MonthPicker months={months} selected={selected} base="/tools/time-report/grant-pass" />
        {manual && (
          <ManualHoursDialog
            rows={manual.rows} options={manual.options} month={selected} blurb={manual.blurb}
          />
        )}
      </div>
      <ProjectHoursReport data={data} />
    </div>
  )
}
