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
  return sheetPdf(request, `/clocky-hours/reports/print${q ? `?${q}` : ''}`, () => 'north-time-report.pdf', {
    width: 860, landscape: true,
    // Its footer says which page it ends on, once the report is measured (12C).
    paged: { fit: true, labels: n => ({ doc: `Page ${n} of ${n}`, receipts: [], on: null }), draw: async pdf => pdf },
  })
}
