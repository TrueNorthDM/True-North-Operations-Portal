/**
 * GET /clocky-hours/invoices/new-sender/<id>/<file>: a file of an invoice
 * sent through the invoice form by someone not in the Directory yet (their
 * PDF, 'pdf', or a receipt, 'r0', 'r1'...), so it can be read before it is
 * linked to a person. To the default approver, Super Admins, Admins and
 * Finance (newSenderRights).
 */

import { NextResponse } from 'next/server'
import { loadAccess } from '@/lib/access/resolve'
import { contentDisposition } from '@/lib/drive/file-names'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadInvoiceSettings } from '@/lib/timeclock/pay-terms'
import { submissionFile } from '@/lib/invoice-form/data'
import { newSenderRights } from '@/lib/invoice-form/rules'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  const access = await loadAccess()
  const { id, file } = await params
  const missing = () => new NextResponse('That file is not open to you.', { status: 404, headers: { 'Content-Type': 'text/plain' } })
  if (!access.can('clocky-invoices') || !/^\d+$/.test(id) || !/^(pdf|r\d{1,2})$/.test(file)) return missing()
  if (!newSenderRights(access, await loadInvoiceSettings()).see) return missing()
  const f = await submissionFile(Number(id), file)
  if (!f) return missing()
  const { data, error } = await createAdminClient().storage.from('receipts').download(f.path)
  if (error || !data) return new NextResponse('The file could not be opened. Try again in a moment.', { status: 500, headers: { 'Content-Type': 'text/plain' } })
  return new NextResponse(data, { headers: { 'Content-Type': data.type || 'application/octet-stream', 'Content-Disposition': contentDisposition(f.name, 'inline'), 'Cache-Control': 'private, no-store' } })
}
