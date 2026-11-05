/**
 * GET /clocky-hours/invoices/<id>/own-pdf: the sender's own invoice PDF, sent
 * with the invoice form (migration 147). To the people who see the invoice:
 * its person, Super Admins and Finance (seesMoney). Read with the
 * service role and sent from here: the file never has an address of its own.
 */

import { NextResponse } from 'next/server'
import { loadAccess } from '@/lib/access/resolve'
import { contentDisposition } from '@/lib/drive/file-names'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadInvoiceSettings, seesMoney } from '@/lib/timeclock/pay-terms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await loadAccess()
  const { id } = await params
  const missing = () => new NextResponse('That file is not open to you.', { status: 404, headers: { 'Content-Type': 'text/plain' } })
  if (!access.can('clocky-invoices') || !/^\d+$/.test(id)) return missing()
  const c = createAdminClient()
  const { data: inv } = await c.from('invoices').select('person_id, number, own_pdf_path').eq('id', Number(id)).maybeSingle()
  if (!inv?.own_pdf_path || !seesMoney(access, inv.person_id, await loadInvoiceSettings())) return missing()
  const { data, error } = await c.storage.from('receipts').download(inv.own_pdf_path)
  if (error || !data) return new NextResponse('The file could not be opened. Try again in a moment.', { status: 500, headers: { 'Content-Type': 'text/plain' } })
  return new NextResponse(data, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': contentDisposition(`${inv.number}-their-invoice.pdf`, 'inline'), 'Cache-Control': 'private, no-store' } })
}
