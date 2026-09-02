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
import { currentYearMonth } from '@/lib/tsheets/report'
import { availableMonths } from '@/lib/tsheets/retention'
import { loadProjectTracking } from '@/lib/timeclock/projects'
import { ProjectHoursReport } from '@/components/tsheets/ProjectHoursReport'
import { MonthPicker } from '@/components/tsheets/MonthPicker'

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

      <MonthPicker months={months} selected={selected} base="/tools/time-report/grant-pass" />
      <ProjectHoursReport data={data} />
      {/* The panel that used to sit here now lives on its own page, because
          one form serves every client and this one only knew how to tag its
          own. The link stays where the panel was, so it is found the same way. */}
      {access.isAdmin ? (
        <Link
          href="/tools/manual-hours"
          className="inline-flex items-center gap-2 text-[13px] font-bold px-4 py-2 rounded-[10px] border border-[var(--panel-border)] bg-white text-tn-ink hover:border-tn-teal transition-colors"
        >
          Add hours by hand
        </Link>
      ) : null}
    </div>
  )
}
