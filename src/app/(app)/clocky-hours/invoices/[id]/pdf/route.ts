/**
 * GET /clocky-hours/invoices/<id>/pdf: the invoice as a PDF, the one the
 * preview window shows (every PDF in the portal opens a preview first; this
 * is what Download fetches). The print page decides who may have it: the
 * person, Super Admins, Admins and Finance (lib/pdf/sheet-pdf.ts).
 */

import { requireSurface } from '@/lib/access/resolve'
import { sheetPdf } from '@/lib/pdf/sheet-pdf'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireSurface('clocky-invoices')
  const { id } = await params
  if (!/^\d+$/.test(id)) return new Response('No such invoice.', { status: 404, headers: { 'Content-Type': 'text/plain' } })
  return sheetPdf(request, `/clocky-hours/invoices/${id}/print`, number => `${number}.pdf`)
}
