// Print/PDF view of the i7 Budget Usage Report: the page the PDF route renders
// (?month=YYYY-MM&type=client|internal&pdf=1). Loads the same data as the
// report (report-data.ts) and hands it to the print layout.
//
// Every outcome is a page the PDF route can tell apart (audit, 9 October 2026):
// the report (.print-doc), a month with no hours yet (.print-doc too, a sheet
// that says so), or a page the route must not turn into a PDF ([data-print-error],
// its text sent back as the reason): a failed read, or a client report with
// hours that have no rate, whose cost would be short without a word.

import type { Metadata } from 'next'
import { previewHref } from '@/lib/auth/view-as-server'
import { redirect } from 'next/navigation'
import { loadAccess } from '@/lib/access/resolve'
import { loadI7ReportData } from '@/lib/tsheets/report-data'
import { availableMonths } from '@/lib/tsheets/retention'
import { currentYearMonth } from '@/lib/tsheets/report'
import { ReportPrint } from '@/components/tsheets/ReportPrint'
import { ROUTES } from '@/lib/nav/routes'

import { monthName as monthLabel } from '@/lib/timeclock/periods'

function PrintError({ children }: { children: string }) {
  return <div data-print-error className="p-10 text-center text-slate-500">{children}</div>
}

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
      ? `i7 Budget Internal Report - ${label}`
      : `i7 Budget Month Report - ${label}`,
  }
}

export default async function ReportPrintPage({ searchParams }: Props) {
  // Same gate as the Export buttons that lead here: this layout carries the
  // full budget and (for `internal`) per-person cost detail.
  if (!(await loadAccess()).can('i7-export')) redirect(await previewHref(ROUTES.i7))

  const { month, type } = await searchParams
  const selectedMonth = resolveMonth(month)
  const kind = type === 'internal' ? 'internal' : 'client'

  let data
  try {
    data = await loadI7ReportData(selectedMonth)
  } catch {
    return <PrintError>The report could not be read just now. Try again in a moment.</PrintError>
  }

  if (!data.report) {
    return (
      <div className="print-doc mx-auto max-w-full bg-white p-12">
        <h1 className="text-[22px] font-extrabold text-[#012358] m-0">i7 Budget Usage Report</h1>
        <p className="text-[15px] text-[#435066] mt-2 m-0">{monthLabel(selectedMonth)}</p>
        <p className="text-[14px] text-[#435066] mt-8 m-0">No i7 hours have been recorded for {monthLabel(selectedMonth)} yet.</p>
      </div>
    )
  }

  if (kind === 'client' && data.unratedPeople.length) {
    const n = data.unratedPeople.length
    return (
      <PrintError>
        {`${n === 1 ? `${data.unratedPeople[0]} has` : `${n} people (${data.unratedPeople.join(', ')}) have`} i7 hours in ${monthLabel(selectedMonth)} and no rate, so the client total would be short. Set the rate in Rates & Costs, then export again.`}
      </PrintError>
    )
  }

  // The company's day, whatever the server's time zone.
  const generatedOn = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' })

  return (
    <ReportPrint
      report={data.report}
      projectHours={data.projectHours}
      carryover={data.carryover}
      stdRate={data.stdRate}
      type={kind}
      monthLabel={monthLabel(selectedMonth)}
      generatedOn={generatedOn}
      note={data.note}
    />
  )
}
