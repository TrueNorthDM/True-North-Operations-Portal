'use client'

// 12A, 12B, 12C, 12U (Reports.dc.html): the real Reports page with the
// prototype's sample. Nothing navigates and nothing downloads.

import { ReportsView } from '@/components/clocky/reports/ReportsView'
import type { ReportPage } from '@/lib/timeclock/reports-data'

export function ReportsCheck({ page, pdf }: { page: ReportPage; pdf: boolean }) {
  return <ReportsView page={page} made="Nov 3, 2026" startPdf={pdf} linked={false} />
}
