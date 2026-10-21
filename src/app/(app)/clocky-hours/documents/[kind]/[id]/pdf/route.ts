/**
 * GET /clocky-hours/documents/<payroll|rmb>/<id>/pdf: a payroll summary or a
 * reimbursement document as a PDF, the one the preview window shows. The
 * print page decides who may have it (lib/timeclock/pay-docs.ts).
 */

import { requireSurface } from '@/lib/access/resolve'
import { sheetPdf } from '@/lib/pdf/sheet-pdf'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  await requireSurface('clocky-hours')
  const { kind, id } = await params
  if ((kind !== 'payroll' && kind !== 'rmb') || !/^\d+$/.test(id)) return new Response('No such document.', { status: 404, headers: { 'Content-Type': 'text/plain' } })
  return sheetPdf(request, `/clocky-hours/documents/${kind}/${id}/print`, title => `${title}.pdf`)
}
