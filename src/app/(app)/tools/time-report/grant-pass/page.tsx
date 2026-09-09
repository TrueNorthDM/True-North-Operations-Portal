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
import { ProjectPeriodFilter } from '@/components/tsheets/ProjectPeriodFilter'
import { resolveRange } from '@/lib/tsheets/range'
import { ManualHoursDialog } from '@/components/tsheets/ManualHoursDialog'
import { loadAllManualHours } from '@/lib/timeclock/manual-data'
import { loadMoneyIn } from '@/lib/timeclock/money-in-data'
import { MoneyInDialog } from '@/components/tsheets/MoneyInDialog'
import { TRACKED_PROJECTS } from '@/lib/timeclock/projects'
import { Breadcrumb } from '@/components/ui/Breadcrumb'

export const metadata = { title: 'Client Report · Project Hours & Others' }
export const dynamic = 'force-dynamic'

const MANUAL_BLURB =
  'Every hour added by hand this month, whichever client it belongs to. They count in the client reports exactly like an imported hour, which is why they are listed here rather than only totalled.'

export default async function ProjectHoursPage({
  searchParams,
}: { searchParams: Promise<{ month?: string; from?: string; to?: string }> }) {
  // The area comes from the level, the report from its own team tool grant.
  const access = await requireSurface('tools')
  if (!access.canTool('grant-pass-report')) redirect('/tools')

  const months = availableMonths(new Date())
  const { month, from, to } = await searchParams
  const newest = months.includes(currentYearMonth()) ? currentYearMonth() : months[0]
  // `month` still works: an old link is a range of one, which is the report it
  // always was. No parameters is the current month, which is what it opens on.
  const range = resolveRange(from ?? month, to ?? month, newest)
  const selected = range.to

  // Privileged, for the reason the i7 report was wrong until 2026-09-01.
  //
  // tc_entries carries the time clock's row-level security: you read your own
  // hours plus the hours of people you approve. A client report read through
  // that rule means a different thing for every viewer, and it fails silently,
  // as a smaller number rather than an error. Who may open this page is the
  // tools surface plus the grant-pass-report team grant, checked right above,
  // and that is the rule an admin can actually see.
  const data = await loadProjectTracking(createAdminClient(), range.from, range.to)

  // Donations and prepaid hours, for whoever may edit them. isPrivileged, not
  // isAdmin: the Admin Assistant is the person who holds these figures, and
  // isAdmin is roleType === 'admin' exactly, which is not her.
  const moneyIn = access.isPrivileged
    ? await loadMoneyIn(createAdminClient(), selected)
    : null

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
        <span className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">Period</span>
        <ProjectPeriodFilter range={range} availableMonths={months} />
        {/* One group, right of the month, the way the i7 toolbar carries its
            own. justify-between had pushed these to opposite ends of the row. */}
        <div className="ml-auto flex items-center gap-2.5">
          {moneyIn && <MoneyInDialog data={moneyIn} projects={TRACKED_PROJECTS} />}
          {manual && (
            <ManualHoursDialog
              rows={manual.rows} options={manual.options} month={selected} blurb={manual.blurb}
              tone="secondary"
            />
          )}
        </div>
      </div>
      <ProjectHoursReport data={data} />
    </div>
  )
}
