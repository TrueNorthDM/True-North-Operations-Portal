// Client Report, Grant Pass.
//
// Its own page and its own tool grant ('grant-pass-report'), not a tab beside
// i7. One permission per client: whoever is trusted with one client's hours and
// budget has not thereby been trusted with every client added later.
//
// The body is still the framework placeholder. Grant Pass time is not reachable
// from the portal's copy of QuickBooks Time yet: the timesheet sync only pulls
// entries under the i7 client tree, and "GP School" / "GP Church" are values of
// the "1 - i7 Code" custom field rather than TSheets job codes, so they never
// arrive. That is a data-source decision, not a missing screen.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'
import { GrantPassReport } from '@/components/tsheets/GrantPassReport'

export const metadata = { title: 'Client Report · Grant Pass' }
export const dynamic = 'force-dynamic'

export default async function GrantPassReportPage() {
  // The area comes from the level, the client from its own team tool grant.
  const access = await requireSurface('tools')
  if (!access.canTool('grant-pass-report')) redirect('/tools')

  return (
    <div className="space-y-8">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm text-muted mb-1">
          <Link href="/" className="hover:text-tn-ink transition-colors">Home</Link>
          <span>/</span>
          <Link href="/tools" className="hover:text-tn-ink transition-colors">Tools</Link>
          <span>/</span>
          <span className="text-foreground font-semibold">Client Report · Grant Pass</span>
        </div>
        <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">
          Client Report · Grant Pass
        </h1>
        <p className="mt-1.5 text-muted leading-relaxed">
          Hours and budget usage for Grant Pass, Church and School.
        </p>
      </div>

      <GrantPassReport />
    </div>
  )
}
