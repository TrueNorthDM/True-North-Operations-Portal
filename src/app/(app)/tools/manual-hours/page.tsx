// Hours added by hand, for every client, in one place.
//
// This used to be two panels, one at the foot of each client report, and each
// only knew how to tag its own client: the i7 one wrote an i7 code, the Grant
// Pass one wrote a project. Neither could have added an hour for a client whose
// report did not exist yet, and keeping two near-identical forms behaving alike
// is how a defect gets in.
//
// One form now, asking what QuickBooks Time asks and in the same order: the top
// job, then the discipline, then the middle that depends on which branch you
// entered by. The reports pick the entries up on their own, because each one
// already looks for the tag it cares about.
//
// Admin only. These hours reach a client invoice.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { currentYearMonth } from '@/lib/tsheets/report'
import { availableMonths } from '@/lib/tsheets/retention'
import { loadAllManualHours } from '@/lib/timeclock/manual-data'
import { ManualHours } from '@/components/tsheets/ManualHours'
import { MonthPicker } from '@/components/tsheets/MonthPicker'

export const dynamic = 'force-dynamic'

export default async function ManualHoursPage(
  { searchParams }: { searchParams: Promise<{ month?: string }> },
) {
  const access = await requireSurface('tools')
  if (!access.isAdmin) redirect('/tools')

  const months = availableMonths(new Date())
  const { month } = await searchParams
  const selected = month && months.includes(month) ? month : currentYearMonth()

  const { rows, options } = await loadAllManualHours(createAdminClient(), selected)

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm text-muted mb-1">
          <Link href="/" className="hover:text-tn-ink transition-colors">Home</Link>
          <span>/</span>
          <Link href="/tools" className="hover:text-tn-ink transition-colors">Tools</Link>
          <span>/</span>
          <span className="text-foreground font-semibold">Hours added by hand</span>
        </div>
        <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">
          Hours added by hand
        </h1>
        <p className="mt-1.5 text-muted leading-relaxed">
          For work billed by somebody without a QuickBooks Time account. Filled in the same order
          and with the same fields as a timesheet over there, so the client reports find these
          hours exactly as they find imported ones.
        </p>
      </div>

      <MonthPicker months={months} selected={selected} base="/tools/manual-hours" />

      <ManualHours
        rows={rows} options={options} month={selected}
        blurb="Every hour added by hand this month, whichever client it belongs to. They count in the client reports exactly like an imported hour, which is why they are listed here rather than only totalled."
      />

      {/* The one thing the form cannot say for itself. QuickBooks Time also
          assigns each top job to people and shows only the assigned ones; the
          portal does not import that, so this list is every active root. */}
      <p className="text-[12.5px] text-muted leading-relaxed m-0">
        The top list is every job at the root of QuickBooks Time, not only the ones assigned to a
        given person. Assignments are not imported, so the form cannot narrow it the way the
        timesheet editor does.
      </p>
    </div>
  )
}
