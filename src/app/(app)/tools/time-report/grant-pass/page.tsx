// Client Report, Project Hours.
//
// This page was "Grant Pass" while nobody knew what it was for. Accounting's own
// tracking sheet settled it: Grants Pass is two rows of a four-project sheet,
// beside AskAnAdventistFriend.com and Hope for Africa, and what it tracks is
// hours rather than money. So the page is that sheet.
//
// It keeps the 'grant-pass-report' tool grant. The key is what permissions are
// stored against, and renaming it would silently revoke access for whoever has
// it today.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadProjectManualHours } from '@/lib/timeclock/manual-data'
import { ManualHours } from '@/components/tsheets/ManualHours'
import { sideFromText } from '@/lib/timeclock/grant-pass'
import { currentYearMonth } from '@/lib/tsheets/report'
import { availableMonths } from '@/lib/tsheets/retention'
import { loadProjectTracking } from '@/lib/timeclock/projects'
import { ProjectHoursReport } from '@/components/tsheets/ProjectHoursReport'
import { MonthPicker } from './MonthPicker'

export const metadata = { title: 'Client Report · Project Hours' }
export const dynamic = 'force-dynamic'

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

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm text-muted mb-1">
          <Link href="/" className="hover:text-tn-ink transition-colors">Home</Link>
          <span>/</span>
          <Link href="/tools" className="hover:text-tn-ink transition-colors">Tools</Link>
          <span>/</span>
          <span className="text-foreground font-semibold">Client Report · Project Hours</span>
        </div>
        <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">
          Client Report · Project Hours
        </h1>
        <p className="mt-1.5 text-muted leading-relaxed">
          AskAnAdventistFriend.com, Grants Pass Church and School, and Hope for Africa. Hours by
          person and by month, the same shape as the tracking sheet.
        </p>
      </div>

      <MonthPicker months={months} selected={selected} />
      <ProjectHoursReport data={data} />
      {/* Admins only: this writes hours that reach a client report. Below the
          report rather than beside it, because it is a correction to what the
          report already shows and not a second source. */}
      {access.isAdmin ? <GrantPassManualPanel month={selected} /> : null}
    </div>
  )
}

/**
 * Hand-added hours for Grant Pass.
 *
 * The root is found by name because the True North branch has never had an id
 * written down here: only the i7 one did, and only because the reports needed
 * it. The project list narrows to the two GP values through the same
 * `sideFromText` the report reads them with, so the form can only offer what
 * the report can find. One spelling in two places would eventually be two.
 */
async function GrantPassManualPanel({ month }: { month: string }) {
  const { rows, options } = await loadProjectManualHours(
    createAdminClient(),
    month,
    /^1\s*-\s*True North$/i,
    label => sideFromText(label) !== null,
  )
  return (
    <ManualHours
      rows={rows} options={options} month={month}
      blurb="For Grant Pass work billed without a timeclock account. Tagged the way the report finds it, under 2 Project, so these count exactly like any imported hour."
    />
  )
}
