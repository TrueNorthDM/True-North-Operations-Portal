// Clocky > Reports (Clocky part 2, Reports.dc.html 12A, 12B): hours across
// the company, by team, person and client. Who is in it, and whether money
// shows, is lib/timeclock/reports-data.ts.

import { requireSurface } from '@/lib/access/resolve'
import { loadReport } from '@/lib/timeclock/reports-data'
import { parseReportQuery } from '@/lib/timeclock/reports'
import { dateLabel, localDate } from '@/lib/timeclock/format'
import { loadDirectory } from '@/lib/timeclock/clocky-context'
import { ReportsView } from '@/components/clocky/reports/ReportsView'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Reports' }

export default async function ReportsRoute({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await requireSurface('clocky-reports')
  const page = await loadReport(access, parseReportQuery(await searchParams))
  if (!page) return <p role="alert" className="m-0 text-[13px] font-semibold text-[#c8323d]">Your login is not linked to anyone in the Directory.</p>
  const zone = (await loadDirectory()).zoneOf(access.personId!)
  return <ReportsView page={page} made={dateLabel(localDate(new Date(), zone))} />
}
