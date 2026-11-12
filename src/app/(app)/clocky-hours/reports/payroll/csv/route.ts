/**
 * GET /clocky-hours/reports/payroll/csv?start=YYYY-MM-DD: the payroll summary
 * file for one pay period (lib/timeclock/payroll-summary.ts), the shape Tina
 * sends to Rippling. Super Admins and Finance only.
 */

import { loadAccess } from '@/lib/access/resolve'
import { canSeePayroll, loadPayroll } from '@/lib/timeclock/payroll-summary-data'
import { payrollCsv } from '@/lib/timeclock/payroll-summary'
import { contentDisposition } from '@/lib/drive/file-names'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const refuse = (text: string) => new Response(text, { status: 404, headers: { 'Content-Type': 'text/plain' } })

export async function GET(request: Request) {
  const access = await loadAccess()
  // A file, not a page: a 404 rather than a redirect whose HTML would download as the CSV.
  if (!access.can('clocky-reports') || !(await canSeePayroll(access))) return refuse('The payroll summary is not open to you.')
  const page = await loadPayroll(new URL(request.url).searchParams.get('start') ?? undefined)
  if (!page) return refuse('The company pay period start is not set.')
  return new Response(payrollCsv(page.lines), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': contentDisposition(`${page.file}.csv`), 'Cache-Control': 'no-store' },
  })
}
