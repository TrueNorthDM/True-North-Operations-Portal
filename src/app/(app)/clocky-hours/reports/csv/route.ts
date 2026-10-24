/**
 * GET /clocky-hours/reports/csv?<filters>: the report's people as CSV
 * (Reports.dc.html, "CSV"), with the same people and columns the page shows.
 */

import { loadAccess } from '@/lib/access/resolve'
import { loadReport } from '@/lib/timeclock/reports-data'
import { parseReportQuery, reportCsv } from '@/lib/timeclock/reports'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const access = await loadAccess()
  // A file, not a page: a 404 rather than a redirect Home whose HTML would download as the CSV.
  if (!access.can('clocky-reports')) return new Response('Reports are not open to you.', { status: 404, headers: { 'Content-Type': 'text/plain' } })
  const page = await loadReport(access, parseReportQuery(Object.fromEntries(new URL(request.url).searchParams)))
  if (!page) return new Response('Your login is not linked to anyone in the Directory.', { status: 404, headers: { 'Content-Type': 'text/plain' } })
  return new Response(reportCsv(page.view), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${page.file}.csv"`, 'Cache-Control': 'no-store' },
  })
}
