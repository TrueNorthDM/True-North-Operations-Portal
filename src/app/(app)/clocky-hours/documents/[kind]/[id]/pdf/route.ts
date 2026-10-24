/**
 * GET /clocky-hours/documents/<payroll|rmb>/<id>/pdf: a payroll summary or a
 * reimbursement document as a PDF, the one the preview window shows. The
 * print page decides who may have it (lib/timeclock/pay-docs.ts). A
 * reimbursement document brings its receipts as pages (9D-p).
 */

import { loadAccess } from '@/lib/access/resolve'
import { sheetPdf } from '@/lib/pdf/sheet-pdf'
import { viewerFor } from '@/lib/timeclock/clocky-context'
import { docSurface, loadRmbDoc } from '@/lib/timeclock/pay-docs'
import { drawPdfReceipts } from '@/lib/timeclock/receipt-files'
import { pageLabels } from '@/lib/timeclock/receipt-pages'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const access = await loadAccess()
  const { kind, id } = await params
  const missing = (body: string) => new Response(body, { status: 404, headers: { 'Content-Type': 'text/plain' } })
  if ((kind !== 'payroll' && kind !== 'rmb') || !/^\d+$/.test(id)) return missing('No such document.')
  // The page that opens it: a payroll summary from Time entries, a reimbursement document from Requests.
  // A file, not a page: a 404 rather than a redirect Home whose HTML would come back as the PDF.
  if (!access.can(docSurface(kind))) return missing('That document is not open to you.')
  const print = `/clocky-hours/documents/${kind}/${id}/print`
  if (kind === 'payroll') return sheetPdf(request, print, title => `${title}.pdf`)
  // The same money rule as the print page; the PDF receipts' bytes come back with it.
  const files = new Map<number, Uint8Array>()
  const doc = await loadRmbDoc(access, Number(id), (await viewerFor(access))?.zone ?? 'America/New_York', files)
  if (!doc) return missing('That document is not open to you.')
  return sheetPdf(request, print, title => `${title}.pdf`, {
    width: 620, landscape: false,
    paged: { labels: n => pageLabels(n, doc.receipts), draw: (pdf, boxes, pxToPt) => drawPdfReceipts(pdf, boxes, files, pxToPt) },
  })
}
