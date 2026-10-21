// The page the report PDF route renders headless (Reports.dc.html 12C): the
// same report, with the same filters and the same people, as one sheet.

import { notFound } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'
import { loadReport } from '@/lib/timeclock/reports-data'
import { parseReportQuery } from '@/lib/timeclock/reports'
import { dateLabel, localDate } from '@/lib/timeclock/format'
import { loadDirectory } from '@/lib/timeclock/clocky-context'
import { ReportSheet } from '@/components/clocky/reports/ReportSheet'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Clocky report' }

export default async function ReportPrintPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await requireSurface('clocky-reports')
  const page = await loadReport(access, parseReportQuery(await searchParams))
  if (!page) notFound()
  const zone = (await loadDirectory()).zoneOf(access.personId!)
  return <ReportSheet view={page.view} scope={page.scopeText} file={page.file} made={dateLabel(localDate(new Date(), zone))} />
}
