// Design check: Timesheet periods (design handoff of 16 October 2026,
// Timesheet Periods.dc.html), the real screens with the prototype's data.
//
//   ?frame=5A     Company settings > Timesheet periods, reading
//   ?frame=5A2    editing, the start date moved to Thu, Oct 8: the amber line and "Move the pay periods?"
//   ?frame=5B     Clarise Nixon's page, Work tab: the Timesheet section
//   ?frame=5B2    editing it: Monthly picked, the "starts" line
//   ?frame=5C     Directory > Rates & Costs: the Timesheet column and its filter
//   ?frame=5C2    editing: two cadences changed, highlighted
//   ?frame=5C3    "Change how these people submit?"
//   ?level=admin  5A at the Admin level (read only)
//
// Nothing reads or writes the database. Development only.

import { notFound } from 'next/navigation'
import { PeriodsFrame } from './PeriodsFrame'

export const dynamic = 'force-dynamic'

export default async function ClockyPeriodsCheck({ searchParams }: { searchParams: Promise<{ frame?: string; level?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { frame = '5A', level } = await searchParams
  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <PeriodsFrame frame={frame} level={level === 'admin' ? 'admin' : 'super'} />
    </div>
  )
}
