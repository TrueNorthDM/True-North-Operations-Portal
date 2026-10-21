/**
 * GET /clocky-hours/reports/pdf?<filters>: the report as a landscape PDF, the
 * one the preview window shows (Reports.dc.html 12C). The print page reads it
 * with the same filters and the same gate.
 */

import { requireSurface } from '@/lib/access/resolve'
import { sheetPdf } from '@/lib/pdf/sheet-pdf'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  await requireSurface('clocky-reports')
  const query = new URL(request.url).searchParams
  query.delete('_vs')
  const q = query.toString()
  return sheetPdf(request, `/clocky-hours/reports/print${q ? `?${q}` : ''}`, () => 'clocky-report.pdf', { width: 860, landscape: true, allPages: true })
}
