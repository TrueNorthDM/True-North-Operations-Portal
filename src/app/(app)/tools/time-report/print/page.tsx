// Print/PDF view of the i7 Budget Usage Report. Reached from the "Export" menu
// on the report page: ?month=YYYY-MM&type=client|internal. Loads the same data
// as the report (report-data.ts) and hands it to the print layout, which opens
// the browser's print dialog so the user can Save as PDF.

import type { Metadata } from 'next'
import { loadI7ReportData } from '@/lib/tsheets/report-data'
import { availableMonths } from '@/lib/tsheets/retention'
import { currentYearMonth } from '@/lib/tsheets/report'
import { ReportPrint } from '@/components/tsheets/ReportPrint'

const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const monthLabel = (ym: string) => `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`

interface Props {
  searchParams: Promise<{ month?: string; type?: string }>
}

function resolveMonth(month?: string): string {
  const months = availableMonths(new Date())
  const cur = currentYearMonth()
  return month && months.includes(month) ? month : months.includes(cur) ? cur : months[0]
}

// The <title> is what the browser suggests as the saved-PDF filename.
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { month, type } = await searchParams
  const label = monthLabel(resolveMonth(month))
  return {
    title: type === 'internal'
      ? `i7 Budget Usage Report — ${label} (Internal)`
      : `i7 Marketing — Monthly Report — ${label}`,
  }
}

export default async function ReportPrintPage({ searchParams }: Props) {
  const { month, type } = await searchParams
  const selectedMonth = resolveMonth(month)
  const kind = type === 'internal' ? 'internal' : 'client'

  let data
  try {
    data = await loadI7ReportData(selectedMonth)
  } catch {
    return <div className="p-10 text-center text-slate-500">Couldn&apos;t load the report. Try again from the report page.</div>
  }

  if (!data.report) {
    return <div className="p-10 text-center text-slate-500">No i7 hours for {monthLabel(selectedMonth)} yet.</div>
  }

  // Server time is fine for a "generated on" stamp.
  const generatedOn = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <ReportPrint
      report={data.report}
      projectHours={data.projectHours}
      carryover={data.carryover}
      stdRate={data.stdRate}
      trend={data.trend}
      type={kind}
      monthLabel={monthLabel(selectedMonth)}
      generatedOn={generatedOn}
      note={data.note}
    />
  )
}
