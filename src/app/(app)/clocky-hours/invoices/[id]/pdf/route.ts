/**
 * GET /clocky-hours/invoices/<id>/pdf: the invoice as a PDF, the one the
 * preview window shows (every PDF in the portal opens a preview first; this
 * is what Download fetches). The print page decides who may have it: the
 * person, Super Admins and Finance (lib/pdf/sheet-pdf.ts). Named as
 * its copy in Google Drive: "INV-2026-010-Arnaldo Oliveira.pdf" (owner, 31
 * October 2026).
 *
 * The invoice then its record page, the same file as the Drive copy (owner, 4
 * November 2026): the builder's sheet and the record, or their own PDF as
 * they sent it with the record after it (lib/pdf/invoice-pdf.ts).
 */

import { loadAccess } from '@/lib/access/resolve'
import { internalOrigin } from '@/lib/auth/public-origin'
import { invoiceFileName } from '@/lib/drive/doc-names'
import { contentDisposition } from '@/lib/drive/file-names'
import { printInvoicePdf } from '@/lib/pdf/invoice-pdf'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const text = (body: string, status: number) => new Response(body, { status, headers: { 'Content-Type': 'text/plain' } })

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // A file, not a page: a 404 rather than a redirect Home whose HTML would come back as the PDF.
  if (!(await loadAccess()).can('clocky-invoices') || !/^\d+$/.test(id)) return text('No such invoice.', 404)
  const target = new URL(`/clocky-hours/invoices/${id}/print`, internalOrigin(request.url))
  // The View Stage preview, as sheetPdf passes it.
  const vs = new URL(request.url).searchParams.get('_vs')
  if (vs) target.searchParams.set('_vs', vs)
  const cookie = request.headers.get('cookie') ?? ''
  try {
    const pdf = await printInvoicePdf(Number(id), target, cookie ? { cookie } : {})
    if (!pdf) return text('That document is not open to you.', 404)
    const name = (await invoiceFileName(Number(id))) ?? `invoice-${id}.pdf`
    return new Response(pdf as unknown as BodyInit, {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': contentDisposition(name), 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error('[invoice pdf] generation failed:', err)
    return text('The PDF could not be made. Try again in a moment.', 500)
  }
}
