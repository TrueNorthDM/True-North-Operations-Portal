// Print/PDF view of Project Hours & Others, reached from the report's Export
// menu: ?month=YYYY-MM&type=client|internal. Loads the same data the report
// does and hands it to the print layout.
//
// A month, not a range. The sheet is headed with one period and laid out for a
// page, and the Export menu greys the PDF out until a single month is chosen,
// for the same reason the i7 one does.

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadProjectTracking } from '@/lib/timeclock/projects'
import { availableMonths } from '@/lib/tsheets/retention'
import { currentYearMonth } from '@/lib/tsheets/report'
import { spanWording } from '@/lib/tsheets/range'
import { ProjectHoursPrint } from '@/components/tsheets/ProjectHoursPrint'

interface Props {
  searchParams: Promise<{ month?: string; type?: string }>
}

function resolveMonth(month?: string): string {
  const months = availableMonths(new Date())
  const cur = currentYearMonth()
  return month && months.includes(month) ? month : months.includes(cur) ? cur : months[0]
}

// The <title> is what a browser suggests as the saved-PDF filename.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { month, type } = await searchParams
  const label = spanWording(resolveMonth(month), resolveMonth(month))
  return {
    title: type === 'internal'
      ? `Project Hours by Person - ${label}`
      : `Project Hours and Others - ${label}`,
  }
}

export default async function ProjectHoursPrintPage({ searchParams }: Props) {
  const access = await requireSurface('tools')
  if (!access.canTool('grant-pass-report')) redirect('/work-tools')

  const { month, type } = await searchParams
  const selected = resolveMonth(month)
  const kind = type === 'internal' ? 'internal' : 'client'

  let data
  try {
    data = await loadProjectTracking(createAdminClient(), selected)
  } catch {
    return <div className="p-10 text-center text-slate-500">Couldn&apos;t load the report. Try again from the report page.</div>
  }

  const generatedOn = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <ProjectHoursPrint
      data={data}
      type={kind}
      periodLabel={spanWording(selected, selected)}
      generatedOn={generatedOn}
    />
  )
}
